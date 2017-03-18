'use strict';

module.exports = grunt => {

  const
    fs = require('fs'),
    pathUtil = require('path'),
    filelist = require('stats-filelist'),
    htmlclean = require('htmlclean'),
    CleanCSS = require('clean-css'),

    ROOT_PATH = __dirname,
    WORK_PATH = pathUtil.join(ROOT_PATH, 'temp'),

    APP_PATH = pathUtil.join(ROOT_PATH, 'lib/app'),
    WORK_APP_PATH = pathUtil.join(WORK_PATH, 'app'),

    WORK_VSCE_PATH = pathUtil.join(WORK_PATH, 'vsce'),
    WORK_ASAR_PATH = pathUtil.join(WORK_VSCE_PATH, 'lib/app.asar'),

    PACKAGE_JSON_PATH = pathUtil.join(ROOT_PATH, 'package.json'),
    PACKAGE_JSON = require(PACKAGE_JSON_PATH),

    TXT_APP_ASSETS = filelist.getSync(APP_PATH, {
      filter: stats => stats.isFile() && /\.(?:css|js)$/.test(stats.name),
      listOf: 'fullPath'
    }),

    SHARE_ASSETS = [
      'node_modules/jquery/dist/jquery.min.js'
    ].map(path => pathUtil.join(ROOT_PATH, path)),

    // node_modules that are referred or embedded. i.e. These are not copied into node_modules.
    // EXPAND_MODULES = [],

    EXT_TXT_FILES = [
      {
        expand: true,
        cwd: `${ROOT_PATH}/`,
        src: [
          'README.md',
          'lib/*.*',
          'palettes/**'
        ],
        dest: `${WORK_VSCE_PATH}/`
      },
      {
        src: `${ROOT_PATH}/extension_.js`,
        dest: `${WORK_VSCE_PATH}/extension.js`
      }
    ],

    EXT_BIN_FILES = [
      {
        src: PACKAGE_JSON_PATH,
        dest: pathUtil.join(WORK_VSCE_PATH, 'package.json')
      },
      {
        src: pathUtil.join(ROOT_PATH, 'icon.png'),
        dest: pathUtil.join(WORK_VSCE_PATH, 'icon.png')
      }
    ],

    PACK_MODULES = ['process-bridge'],

    embeddedAssets = [], referredAssets = [], protectedText = [];

  function productSrc(content) {
    return content
      .replace(/[^\n]*\[DEBUG\/\][^\n]*\n?/g, '')
      .replace(/[^\n]*\[DEBUG\][\s\S]*?\[\/DEBUG\][^\n]*\n?/g, '');
  }

  function removeBanner(content) { // remove it to embed
    return content.replace(/^\s*(?:\/\*[\s\S]*?\*\/\s*)+/, '');
  }

  function minCss(content) {
    return (new CleanCSS({keepSpecialComments: 0})).minify(content).styles;
  }

  function minJs(content) { // simple minify
    return content
      .replace(/(^|\n) *\/\*\*\n(?: *\* [^\n]*\n)* *\*\//g, '$1') // JSDoc
      .replace(/\/\*[^\[\]]*?\*\//g, '')
      .replace(/((?:^|\n)[^\n\'\"\`\/]*?)\/\/[^\n\[\]]*(?=\n|$)/g, '$1') // safe
      .replace(/(^|\n)[ \t]+/g, '$1')
      .replace(/[ \t]+($|\n)/g, '$1')
      .replace(/\n{2,}/g, '\n')
      .replace(/^\s+|\s+$/g, '');
  }

  function addProtectedText(text) {
    if (typeof text !== 'string' || text === '') { return ''; }
    protectedText.push(text);
    return `\f${protectedText.length - 1}\x07`;
  }

  // Redo String#replace until target is not found
  function replaceComplete(text, re, fnc) {
    const reg = new RegExp(re); // safe (not literal)
    let doNext = true;
    function fncWrap() {
      doNext = true;
      return fnc.apply(null, arguments);
    }
    // This is faster than using RegExp#exec() and RegExp#lastIndex,
    // because replace() isn't called more than twice in almost all cases.
    while (doNext) {
      doNext = false;
      text = text.replace(reg, fncWrap);
    }
    return text;
  }

  grunt.initConfig({
    clean: {
      workDir: {
        options: {force: true},
        src: [`${WORK_APP_PATH}/**/*`, `${WORK_VSCE_PATH}/**/*`]
      }
    },

    taskHelper: {
      packHtml: {
        options: {
          handlerByContent: content => {
            function getContent(path) {
              if (!fs.existsSync(path)) {
                grunt.fail.fatal(`File doesn't exist: ${path}`);
              }
              const content = removeBanner(fs.readFileSync(path, {encoding: 'utf8'})).trim();
              if (/\f|\x07/.test(content)) { // eslint-disable-line no-control-regex
                grunt.fail.fatal(`\\f or \\x07 that is used as marker is included: ${path}`);
              }

              if (embeddedAssets.indexOf(path) < 0) { embeddedAssets.push(path); }
              return content;
            }

            function getRefPath(path) {
              if (!fs.existsSync(path)) {
                grunt.fail.fatal(`File doesn't exist: ${path}`);
              }
              const relPath = path.indexOf(APP_PATH) === 0 ?
                  pathUtil.relative(APP_PATH, path) : pathUtil.basename(path),
                dest = pathUtil.join(WORK_APP_PATH, relPath);

              if (referredAssets.findIndex(referredAsset => referredAsset.src === path) < 0) {
                referredAssets.push({src: path, dest: dest});
              }
              return relPath;
            }

            function packCss(s, left, path, right) {
              path = pathUtil.resolve(APP_PATH, path);
              if (SHARE_ASSETS.indexOf(path) < 0) {
                let content = getContent(path).replace(/^\s*@charset\s+[^;]+;/gm, '');
                if (!/\.min\./.test(path)) { content = minCss(productSrc(content)); }
                return `<style>${addProtectedText(content)}</style>`;
              } else {
                return addProtectedText(`${left}./${getRefPath(path)}${right}`);
              }
            }

            function packJs(s, left, path, right) {
              path = pathUtil.resolve(APP_PATH, path);
              if (SHARE_ASSETS.indexOf(path) < 0) {
                let content = getContent(path).replace(/^[;\s]+/, '').replace(/[;\s]*$/, ';');
                if (!/\.min\./.test(path)) { content = minJs(productSrc(content)); }
                return `<script>${addProtectedText(content)}</script>`;
              } else {
                return addProtectedText(`${left}./${getRefPath(path)}${right}`);
              }
            }

            if (/\f|\x07/.test(content)) { // eslint-disable-line no-control-regex
              grunt.fail.fatal('\\f or \\x07 that is used as marker is included');
            }

            content = htmlclean(productSrc(content))
              .replace(/(<link\b[^>]*href=")(.+?)("[^>]*>)/g, packCss)
              .replace(/(<script\b[^>]*src=")(.+?)("[^>]*><\/script>)/g, packJs)
              .replace(/(require\(')(.+?)('\))/g, packJs) // must be included in UNPACK_ASSETS
              .replace(/<\/style><style>/g, '')
              .replace(/<\/script><script>/g, '');
            // Restore protected texts
            // eslint-disable-next-line no-control-regex
            return replaceComplete(content, /\f(\d+)\x07/g, (s, i) => protectedText[i] || '');
          }
        },
        expand: true,
        cwd: `${APP_PATH}/`,
        src: '**/*.html',
        dest: `${WORK_APP_PATH}/`
      },

      getCopyFiles: {
        options: {
          handlerByTask: () => {
            const txtFiles = TXT_APP_ASSETS
              .filter(path => embeddedAssets.indexOf(path) < 0 &&
                referredAssets.findIndex(referredAsset => referredAsset.src === path) < 0)
              .map(srcPath => ({
                src: srcPath,
                dest: pathUtil.join(WORK_APP_PATH, pathUtil.relative(APP_PATH, srcPath))
              }))
              .concat(referredAssets, EXT_TXT_FILES);
            grunt.config.merge({copy: {txtFiles: {files: txtFiles}}});
          }
        }
      },

      appPackageJson: {
        options: {
          handlerByContent: content => {
            const packageJson = JSON.parse(content);
            packageJson.version = PACKAGE_JSON.version;
            return JSON.stringify(packageJson);
          }
        },
        src: `${APP_PATH}/package.json`,
        dest: `${WORK_APP_PATH}/package.json`
      },

      // Since vsce checks modules even if `.vscodeignore` is written, copy dummy packages.
      dummyModules: {
        options: {
          handlerByContent: content => {
            const packageJson = JSON.parse(content);
            delete packageJson.dependencies;
            return JSON.stringify(packageJson);
          }
        },
        expand: true,
        cwd: `${ROOT_PATH}/`,
        src: Object.keys(PACKAGE_JSON.dependencies)
          .filter(moduleName => PACK_MODULES.indexOf(moduleName) < 0)
          .map(moduleName => `node_modules/${moduleName}/package.json`),
        dest: `${WORK_VSCE_PATH}/`
      },

      vscodeIgnore: {
        options: {
          handlerByTask: () => {
            fs.writeFileSync(pathUtil.join(WORK_VSCE_PATH, '.vscodeignore'),
              Object.keys(PACKAGE_JSON.dependencies)
                .filter(dependency => PACK_MODULES.indexOf(dependency) < 0)
                .map(dependency => `node_modules/${dependency}/**\n`)
                .join(''));
          }
        }
      }
    },

    copy: {
      txtFiles: {
        options: {
          process: (content, path) => {
            const isMin = /\.min\./.test(path);
            if (/\.css$/.test(path)) {
              content = removeBanner(content);
              if (!isMin) { content = minCss(productSrc(content)); }
            } else if (/\.js$/.test(path)) {
              content = removeBanner(content);
              if (!isMin) { content = minJs(productSrc(content)); }
            } else if (/\.svg$/.test(path)) {
              if (!isMin) { content = htmlclean(content); }
            } else if (pathUtil.basename(path) === 'package.json') {
              let packageJson = JSON.parse(content);
              // keys that are not required by electron
              ['keywords', 'dependencies', 'devDependencies', 'homepage', 'repository', 'bugs']
                .forEach(key => { delete packageJson[key]; });
              content = JSON.stringify(packageJson);
            }
            return content;
          }
        }
      },

      // `copy.options.process` breaks binary files.
      binFiles: {
        files: [{
          expand: true,
          cwd: `${APP_PATH}/`,
          src: ['**/*.{png,svgz,jpg,jpeg,jpe,jif,jfif,jfi,webp,bmp,dib,git,eot,ttf,woff,woff2}'],
          dest: `${WORK_APP_PATH}/`
        }].concat(
          EXT_BIN_FILES,
          PACK_MODULES.map(moduleName => ({
            expand: true,
            cwd: `${ROOT_PATH}/`,
            src: `node_modules/${moduleName}/**`,
            dest: `${WORK_VSCE_PATH}/`
          }))
        )
      }
    }
  });

  grunt.registerTask('asar', function() {
    const asar = require('asar'),
      done = this.async(); // eslint-disable-line no-invalid-this

    asar.createPackage(`${WORK_APP_PATH}/`, WORK_ASAR_PATH, error => {
      if (error) {
        done(error);
      } else {

        const asarList = asar.listPackage(WORK_ASAR_PATH);
        fs.renameSync(WORK_ASAR_PATH, `${WORK_ASAR_PATH}_`);
        let list = filelist.getSync(WORK_VSCE_PATH)
          .reduce((list, stats) => {
            if (stats.isFile()) {
              list.push(pathUtil.relative(WORK_VSCE_PATH, stats.fullPath));
            }
            return list;
          }, []);

        fs.writeFileSync(pathUtil.join(WORK_PATH, `publish-files-${PACKAGE_JSON.version}.txt`),
          `asar l app.asar\n\n${asarList.join('\n')}\n\n` +
          `vsce ls\n\n${list.join('\n')}\n`);
        done();
      }
    });
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-task-helper');
  grunt.loadNpmTasks('grunt-contrib-copy');

  grunt.registerTask('default', [
    'clean:workDir',
    'taskHelper:packHtml',
    'taskHelper:getCopyFiles',
    'copy:txtFiles',
    'copy:binFiles',
    'taskHelper:appPackageJson',
    'asar',
    'taskHelper:dummyModules',
    'taskHelper:vscodeIgnore'
  ]);
};

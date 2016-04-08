'use strict';

module.exports = grunt => {

  const
    fs = require('fs'),
    pathUtil = require('path'),
    filelist = require('stats-filelist'),
    htmlclean = require('htmlclean'),
    CleanCSS = require('clean-css'),

    PACKAGE_ROOT_PATH = __dirname,
    TEMP_PATH = pathUtil.join(PACKAGE_ROOT_PATH, 'temp'),

    SRC_APP_DIR_PATH = pathUtil.join(PACKAGE_ROOT_PATH, 'lib/app'),
    WORK_VSCE_PATH = pathUtil.join(TEMP_PATH, 'vsce'),
    WORK_APP_DIR_PATH = pathUtil.join(WORK_VSCE_PATH, 'app'),

    PACKAGE_JSON_PATH = pathUtil.join(PACKAGE_ROOT_PATH, 'package.json'),
    PACKAGE_JSON = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH)),

    SRC_ASSETS = filelist.getSync(SRC_APP_DIR_PATH, {
      filter: stats =>
        stats.isFile() &&
        !/^\./.test(stats.name) &&
        !/\.scss$/.test(stats.name) &&
        !/\.html$/.test(stats.name) &&
        !/\.svg$/.test(stats.name) &&
        stats.name !== 'package.json',
      listOf: 'fullPath'
    }),

    UNPACK_ASSETS = [
      'node_modules/jquery/dist/jquery.min.js'
    ].map(path => pathUtil.join(PACKAGE_ROOT_PATH, path)),

    PACK_MODULES = ['process-bridge'];

  var excludeSrcAssets = [], copiedAssets = [], protectedText = [];

  function productSrc(src) {
    return src
      .replace(/[^\n]*\[DEBUG\/\][^\n]*\n?/g, '')
      .replace(/[^\n]*\[DEBUG\][\s\S]*?\[\/DEBUG\][^\n]*\n?/g, '');
  }

  function minCss(content) {
    return (new CleanCSS({keepSpecialComments: 0})).minify(content).styles;
  }

  function minJs(content) { // simple minify
    return content
      .replace(/\/\*[^\[\]]*?\*\//g, '')
      .replace(/((?:^|\n)[^\n\'\"\`\/]*?)\/\/[^\n\[\]]*(?=\n|$)/g, '$1') // safe
      .replace(/(^|\n)[ \t]+/g, '$1')
      .replace(/[ \t]+($|\n)/g, '$1')
      .replace(/\n{2,}/g, '\n');
  }

  function addProtectedText(text) {
    if (typeof text !== 'string' || text === '') { return ''; }
    protectedText.push(text);
    return `\f${protectedText.length - 1}\x07`;
  }

  // Redo String#replace until target is not found
  function replaceComplete(text, re, fnc) {
    var doNext = true, reg = new RegExp(re); // safe (not literal)
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

  function isExists(path) {
    try {
      fs.accessSync(path); // only check existence.
      return true;
    } catch (error) {
      return false;
    }
  }

  function mkdirP(path) { // mkdir -p
    path.split(/\/|\\/).reduce((parents, dir) => {
      var path = pathUtil.resolve((parents += dir + pathUtil.sep)); // normalize
      if (!isExists(path)) {
        fs.mkdirSync(path);
      } else if (!fs.statSync(path).isDirectory()) {
        throw new Error('Non directory already exists: ' + path);
      }
      return parents;
    }, '');
  }

  grunt.initConfig({
    clean: {
      workDir: {
        options: {force: true},
        src: [`${WORK_VSCE_PATH}/**/*`]
      }
    },

    taskHelper: {
      packHtml: {
        options: {
          handlerByContent: content => {
            function getContent(path) {
              var content;
              if (path.indexOf(SRC_APP_DIR_PATH) !== 0) {
                grunt.log.writeln(`File doesn't exist in src dir: ${path}`);
              } else if (!fs.existsSync(path)) {
                grunt.fail.fatal(`File doesn't exist: ${path}`);
              }
              content = fs.readFileSync(path, {encoding: 'utf8'}).trim();
              if (/\f|\x07/.test(content)) {
                grunt.fail.fatal(`\\f or \\x07 that is used as marker is included: ${path}`);
              }
              return content;
            }

            function packCss(s, left, path, right) {
              function getCssContent(path) {
                return getContent(path).replace(/^\s*(?:\/\*[\s\S]*?\*\/\s*)+/, '');
              }

              path = pathUtil.join(SRC_APP_DIR_PATH, path);
              excludeSrcAssets.push(path);
              if (UNPACK_ASSETS.indexOf(path) < 0) {
                let content = getCssContent(path).replace(/^\s*@charset\s+[^;]+;/gm, '');
                if (!/\.min\.css$/.test(path)) { content = minCss(productSrc(content)); }
                return `<style>${addProtectedText(content)}</style>`;
              } else {
                let basename = pathUtil.basename(path);
                if (/\.min\.css$/.test(path)) {
                  if (copiedAssets.indexOf(path) < 0) { copiedAssets.push(path); }
                } else {
                  basename = basename.replace(/\.css$/, '.min.css');
                  fs.writeFileSync(pathUtil.join(WORK_APP_DIR_PATH, basename),
                    minCss(productSrc(getCssContent(path))));
                }
                return addProtectedText(`${left}./${basename}${right}`);
              }
            }

            function packJs(s, left, path, right) {
              function getJsContent(path) {
                return getContent(path)
                  .replace(/^\s*(?:\/\*[\s\S]*?\*\/\s*)+/, '')
                  .replace(/\s*\n\s*\/\/[^\n]*\s*$/, '')
                  .replace(/^[;\s]+/, '')
                  .replace(/[;\s]*$/, ';');
              }

              path = pathUtil.join(SRC_APP_DIR_PATH, path);
              excludeSrcAssets.push(path);
              if (UNPACK_ASSETS.indexOf(path) < 0) {
                let content = getJsContent(path);
                if (!/\.min\.js$/.test(path)) { content = minJs(productSrc(content)); }
                return `<script>${addProtectedText(content)}</script>`;
              } else {
                let basename = pathUtil.basename(path);
                if (/\.min\.js$/.test(path)) {
                  if (copiedAssets.indexOf(path) < 0) { copiedAssets.push(path); }
                } else {
                  basename = basename.replace(/\.js$/, '.min.js');
                  fs.writeFileSync(pathUtil.join(WORK_APP_DIR_PATH, basename),
                    minJs(productSrc(getJsContent(path))));
                }
                return addProtectedText(`${left}./${basename}${right}`);
              }
            }

            if (/\f|\x07/.test(content)) {
              grunt.fail.fatal('\\f or \\x07 that is used as marker is included');
            }

            content = htmlclean(productSrc(content))
              .replace(/(<link\b[^>]*href=")(.+?)("[^>]*>)/g, packCss)
              .replace(/(<script\b[^>]*src=")(.+?)("[^>]*><\/script>)/g, packJs)
              .replace(/(require\(')(.+?)('\))/g, packJs) // must be included in UNPACK_ASSETS
              .replace(/<\/style><style>/g, '')
              .replace(/<\/script><script>/g, '');
            // Restore protected texts
            return replaceComplete(content, /\f(\d+)\x07/g, (s, i) => protectedText[i] || '');
          }
        },
        expand: true,
        cwd: `${SRC_APP_DIR_PATH}/`,
        src: '**/*.html',
        dest: `${WORK_APP_DIR_PATH}/`
      },

      copyFiles: {
        options: {
          handlerByTask: () => {
            var files = SRC_ASSETS
              .filter(path => excludeSrcAssets.indexOf(path) < 0)
              .map(srcPath => ({
                src: srcPath,
                dest: pathUtil.join(WORK_APP_DIR_PATH, pathUtil.relative(SRC_APP_DIR_PATH, srcPath))
              }))
              .concat(copiedAssets.map(srcPath => ({
                src: srcPath,
                dest: pathUtil.join(WORK_APP_DIR_PATH, pathUtil.basename(srcPath))
              })))
              .reduce((assets, file) => {
                // /(?<!\.min)\.(?:css|js|svg)$/
                if (/\.(?:css|js|svg)$/.test(file.src) && !/\.min\.(?:css|js|svg)$/.test(file.src)) {
                  // files that are not referred from html
                  let content = fs.readFileSync(file.src, {encoding: 'utf8'}).trim();
                  if (/\.css$/.test(file.src)) {
                    content = minCss(productSrc(content.replace(/^\s*(?:\/\*[\s\S]*?\*\/\s*)+/, '')));
                  } else if (/\.js$/.test(file.src)) {
                    content = minJs(productSrc(content));
                  } else { // svg
                    content = htmlclean(content);
                  }
                  fs.writeFileSync(file.dest, content);
                } else {
                  assets.push(file);
                }
                return assets;
              }, [])
              // Since vsce checks modules even if `.vscodeignore` is written, copy dummy packages.
              .concat(Object.keys(PACKAGE_JSON.dependencies).reduce((list, dependency) => {
                if (PACK_MODULES.indexOf(dependency) >= 0) {
                  list.push({
                    expand: true,
                    cwd: PACKAGE_ROOT_PATH,
                    src: `node_modules/${dependency}/**`,
                    dest: `${WORK_VSCE_PATH}/`
                  });
                } else {
                  let packageJson =
                      require(`${PACKAGE_ROOT_PATH}/node_modules/${dependency}/package.json`),
                    destPath = pathUtil.join(WORK_VSCE_PATH, 'node_modules', dependency, 'package.json');
                  delete packageJson.dependencies;
                  mkdirP(pathUtil.dirname(destPath));
                  fs.writeFileSync(destPath, JSON.stringify(packageJson));
                }
                return list;
              }, []));
            // files.push({
            //   src: PACKAGE_JSON_PATH,
            //   dest: pathUtil.join(WORK_DIR_PATH, 'package.json')
            // });
            grunt.config.merge({copy: {copyFiles: {files: files}}});
          }
        }
      },

      appPackageJson: {
        options: {
          handlerByContent: content => {
            var packageJson = JSON.parse(content);
            packageJson.version = PACKAGE_JSON.version;
            return JSON.stringify(packageJson);
          }
        },
        src: `${SRC_APP_DIR_PATH}/package.json`,
        dest: `${WORK_APP_DIR_PATH}/package.json`
      },

      extensionJs: {
        options: {
          handlerByContent: content => {
            return minJs(productSrc(content));
          }
        },
        src: `${PACKAGE_ROOT_PATH}/extension_.js`,
        dest: `${WORK_VSCE_PATH}/extension.js`
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
      extensionFiles: {
        expand: true,
        cwd: `${PACKAGE_ROOT_PATH}/`,
        src: [
          'package.json',
          'README.md',
          'lib/*.*',
          'palettes/**'
        ],
        dest: `${WORK_VSCE_PATH}/`,
        options: {
          process: (content, path) => {
            return /\.js$/.test(path) ? minJs(productSrc(content)) : content;
          }
        }
      },

      // copy.options breaks binary files.
      binFiles: {
        expand: true,
        cwd: `${PACKAGE_ROOT_PATH}/`,
        src: [
          'icon.png'
        ],
        dest: `${WORK_VSCE_PATH}/`
      }
    }
  });

  grunt.registerTask('asar', function() {
    const asar = require('asar'),
      rimraf = require('rimraf'),
      ASAR_PATH = `${WORK_VSCE_PATH}/lib/app.asar`;
    var done = this.async(); // eslint-disable-line no-invalid-this

    asar.createPackage(`${WORK_APP_DIR_PATH}/`, ASAR_PATH, error => {
      var asarList;
      if (error) {
        done(error);
      } else {

        asarList = asar.listPackage(ASAR_PATH);
        fs.renameSync(ASAR_PATH, `${ASAR_PATH}_`);
        rimraf(WORK_APP_DIR_PATH, {glob: false}, error => {
          if (error) {
            done(error);
          } else {
            let list = filelist.getSync(WORK_VSCE_PATH)
              .reduce((list, stats) => {
                if (stats.isFile()) {
                  list.push(pathUtil.relative(WORK_VSCE_PATH, stats.fullPath));
                }
                return list;
              }, []);

            fs.writeFileSync(pathUtil.join(TEMP_PATH, `publish-files-${PACKAGE_JSON.version}.txt`),
              `asar l app.asar\n\n${asarList.join('\n')}\n\n` +
              `vsce ls\n\n${list.join('\n')}\n`);
            done();
          }
        });
      }
    });
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-task-helper');
  grunt.loadNpmTasks('grunt-contrib-copy');

  grunt.registerTask('default', [
    'clean:workDir',
    'taskHelper:packHtml',
    'taskHelper:copyFiles',
    'copy:copyFiles',
    'taskHelper:appPackageJson',
    'copy:extensionFiles',
    'copy:binFiles',
    'taskHelper:extensionJs',
    'asar',
    'taskHelper:vscodeIgnore'
  ]);
};

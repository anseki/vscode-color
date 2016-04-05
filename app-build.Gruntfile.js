'use strict';

module.exports = grunt => {

  const
    fs = require('fs'),
    pathUtil = require('path'),
    filelist = require('stats-filelist'),
    htmlclean = require('htmlclean'),
    CleanCSS = require('clean-css'),

    SRC_DIR_PATH = pathUtil.join(__dirname, 'lib/app'),
    WORK_DIR_PATH = pathUtil.join(__dirname, 'temp/' + pathUtil.basename(SRC_DIR_PATH)),
    MAIN_HTML_PATH = pathUtil.join(SRC_DIR_PATH, 'ui.html');

  var assets = [], protectedText = [];

  function productSrc(src) {
    return src
      .replace(/[^\n]*\[DEBUG\/\][^\n]*\n?/g, '')
      .replace(/[^\n]*\[DEBUG\][\s\S]*?\[\/DEBUG\][^\n]*\n?/g, '');
  }

  function minCss(content) {
    return (new CleanCSS({keepSpecialComments: 0})).minify(content).styles;
  }

  function addProtectedText(text) {
    if (typeof text !== 'string' || text === '') { return ''; }
    protectedText.push(text);
    return '\f' + (protectedText.length - 1) + '\x07';
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

  grunt.initConfig({
    clean: {
      workDir: {
        options: {force: true},
        src: [WORK_DIR_PATH + '/**/*']
      }
    },

    taskHelper: {
      packHtml: {
        options: {
          handlerByContent: content => {
            var packedFiles = {};

            function getContent(path) {
              var content;
              path = pathUtil.join(SRC_DIR_PATH, path);

              if (path.indexOf(SRC_DIR_PATH) !== 0) {
                grunt.fail.fatal('File doesn\'t exist in src dir: ' + path);
              } else if (!fs.existsSync(path)) {
                grunt.fail.fatal('File doesn\'t exist: ' + path);
              }
              packedFiles[path] = true;

              content = fs.readFileSync(path, {encoding: 'utf8'}).trim();
              if (/\f|\x07/.test(content)) {
                grunt.fail.fatal('\\f or \\x07 that is used as marker is included: ' + path);
              }
              return content;
            }

            function packCss(str, path) {
              var content = getContent(path)
                .replace(/^\s*(?:\/\*[\s\S]*?\*\/\s*)+/, '')
                .replace(/^\s*@charset\s+[^;]+;/gm, '');
              if (!/\.min\.css$/.test(path)) {
                content = minCss(content);
              }
              return '<style>' + addProtectedText(content) + '</style>';
            }

            function packJs(str, path) {
              var content = getContent(path)
                .replace(/^\s*(?:\/\*[\s\S]*?\*\/\s*)+/, '')
                .replace(/\s*\n\s*\/\/[^\n]*\s*$/, '')
                .replace(/^[;\s]+/, '')
                .replace(/[;\s]*$/, ';');
              return '<script>' + addProtectedText(content) + '</script>';
            }

            if (/\f|\x07/.test(content)) {
              grunt.fail.fatal('\\f or \\x07 that is used as marker is included: ' + MAIN_HTML_PATH);
            }

            content = htmlclean(content)
              .replace(/<link\b[^>]*href="(.+?)"[^>]*>/g, packCss)
              .replace(/<script\b[^>]*src="(.+?)"[^>]*><\/script>/g, packJs)
              .replace(/<\/style><style>/g, '')
              .replace(/<\/script><script>/g, '');
            // Restore protected texts
            content = replaceComplete(content, /\f(\d+)\x07/g, (s, i) => protectedText[i] || '');

            assets = filelist.getSync(SRC_DIR_PATH, {
              filter: stats => !( // list of excluded items
                  !stats.isFile() ||
                  /^\./.test(stats.name) ||
                  /\.scss$/.test(stats.name) ||
                  stats.fullPath === MAIN_HTML_PATH ||
                  stats.name === 'tr-bg.svg' ||
                  packedFiles[stats.fullPath]
                ),
              listOf: 'fullPath'
            }).map(srcPath => ({
              src: srcPath,
              dest: pathUtil.join(WORK_DIR_PATH, pathUtil.relative(SRC_DIR_PATH, srcPath))
            }));
            grunt.config.merge({
              copy: {
                assets: {
                  files: assets
                }
              }
            });

            return content;
          }
        },
        src: MAIN_HTML_PATH,
        dest: pathUtil.join(WORK_DIR_PATH, pathUtil.relative(SRC_DIR_PATH, MAIN_HTML_PATH))
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-task-helper');
  grunt.loadNpmTasks('grunt-contrib-copy');

  grunt.registerTask('default', [
    'clean:workDir',
    'taskHelper:packHtml',
    'copy:assets'
  ]);
};

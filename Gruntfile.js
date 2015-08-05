/*global module*/

var bbcms = require('./index');
var path = require('path');

var generateChangeDetectionFiles = function (grunt) {
    var srcs = [
        'test/fixtures/sample.txt',
    ];
    var dest = 'test/fixtures/generated';

    srcs.forEach(function (src) {
        var content = grunt.file.read(src);
        var result = bbcms.parseText(content);

        var baseName = path.basename(src, path.extname(src));
        var destName = baseName + '.json';
        var destPath = path.join(dest, destName);
        var destContent = JSON.stringify(result, undefined, 2);
        grunt.file.write(destPath, destContent);
    });
};

module.exports = function (grunt) {

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-istanbul-coverage');
    grunt.loadNpmTasks('grunt-coveralls');
    grunt.loadNpmTasks('grunt-jsbeautifier');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-mocha-phantomjs');
    grunt.loadNpmTasks('grunt-contrib-connect');

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jshint: {
            files: ['*.js', './lib/**/*.js', './test/**/*.js'],
            options: {
                browser: true,
                smarttabs: true,
                curly: true,
                eqeqeq: true,
                immed: true,
                latedef: true,
                newcap: true,
                noarg: true,
                sub: true,
                undef: false,
                boss: true,
                eqnull: true,
                node: true,
                expr: true,
                globals: {
                    'it': true,
                    'xit': true,
                    'describe': true,
                    'before': true,
                    'after': true,
                    'done': true
                }
            }
        },
        watch: {
            all: {
                files: ['./lib/*.js', '*.js'],
                tasks: ['default']
            }
        },
        jsbeautifier: {
            beautify: {
                src: ['Gruntfile.js', 'lib/**/*.js', 'test/*.js', '*.js'],
                options: {
                    config: '.jsbeautifyrc'
                }
            },
            check: {
                src: ['Gruntfile.js', 'lib/*.js', 'test/*.js', '*.js'],
                options: {
                    mode: 'VERIFY_ONLY',
                    config: '.jsbeautifyrc'
                }
            }
        },
        mochaTest: {
            test: {
                options: {
                    reporter: 'spec',
                    timeout: '10000',
                    recursive: true
                },
                src: ['test/*.js']
            }
        },
        coveralls: {
            options: {
                // LCOV coverage file relevant to every target
                src: 'coverage/lcov.info',

                // When true, grunt-coveralls will only print a warning rather than
                // an error, to prevent CI builds from failing unnecessarily (e.g. if
                // coveralls.io is down). Optional, defaults to false.
                force: false
            },
            //your_target: {
            // Target-specific LCOV coverage file
            //src: 'coverage-results/extra-results-*.info'
            //},
        },
        coverage: {
            options: {
                thresholds: {
                    'statements': 50,
                    'branches': 25,
                    'lines': 50,
                    'functions': 50
                },
                dir: 'coverage/',
                root: '.'
            }
        },
        browserify: {
            standalone: {
                src: ['<%=pkg.main%>'],
                dest: 'dist/<%=pkg.name%>.standalone.js',
                options: {
                    standalone: '<%=pkg.name%>'
                }
            },
            require: {
                src: ['<%=pkg.main%>'],
                dest: 'dist/<%=pkg.name%>.js',
                options: {
                    alias: [__dirname + "/index.js:<%=pkg.name%>"]
                }
            },
            tests: {
                src: ['test/**/*.js'],
                dest: 'dist/mocha_tests.js',
                options: {
                    transform: ['brfs']
                }
            }
        },
        connect: {
            server: {
                options: {
                    port: 8000,
                    hostname: '127.0.0.1'
                }
            }
        },
        'mocha_phantomjs': {
            all: {
                options: {
                    urls: [
                        'http://127.0.0.1:8000/dist/mocha_runner.html'
                    ]
                }
            }
        }
    });

    grunt.registerTask('beautify', ['jsbeautifier:beautify']);
    grunt.registerTask('mocha', ['mochaTest']);
    grunt.registerTask('browser-test', ['browserify:require', 'browserify:tests', 'connect', 'mocha_phantomjs']);
    grunt.registerTask('gen-change-detect', 'generates files to detect changes in generation', function () {
        generateChangeDetectionFiles(grunt);
    });

    grunt.registerTask('default', ['beautify', 'jshint', 'mocha', 'browser-test', 'gen-change-detect']);

    grunt.registerTask('commit', ['jshint', 'mocha']);
    grunt.registerTask('timestamp', function () {
        grunt.log.subhead(Date());
    });
};

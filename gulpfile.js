var gulp = require("gulp");
var path = require("path");

var sourcePath = "./www";
var testPath = "./test";
var binPath = "./bin";
var tsFiles = "/**/*.ts";

/* This message is appended to the compiled JS files to avoid contributions to the compiled sources.*/
var compiledSourceWarningMessage = "\n \
/******************************************************************************************** \n \
	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. \n \
	 PLEASE DO NOT MODIFY THIS FILE AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. \n \
	 ALSO, PLEASE DO NOT SUBMIT PULL REQUESTS WITH CHANGES TO THIS FILE. \n \
	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER. \n \
	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.md. \n \
*********************************************************************************************/ \n\n\n";

/* TypeScript compilation parameters */
var tsCompileOptions = {
    "noImplicitAny": true,
    "noEmitOnError": true,
    "target": "ES5",
    "module": "commonjs",
    "sourceMap": false,
    "sortOutput": true,
    "removeComments": true
};

gulp.task("compile", function (callback) {
    var runSequence = require("run-sequence");
    runSequence("compile-src", "compile-test", callback);
});

gulp.task("compile-test", function () {
    var ts = require("gulp-typescript");
    var insert = require("gulp-insert");

    return gulp.src([testPath + tsFiles])
        .pipe(ts(tsCompileOptions))
        .pipe(insert.prepend(compiledSourceWarningMessage))
        .pipe(gulp.dest(path.join(binPath, testPath)));
});

gulp.task("compile-src", function () {
    var ts = require("gulp-typescript");
    var insert = require("gulp-insert");

    return gulp.src([sourcePath + tsFiles])
        .pipe(ts(tsCompileOptions))
        .pipe(insert.prepend(compiledSourceWarningMessage))
        .pipe(gulp.dest(path.join(binPath, sourcePath)));
});

gulp.task("tslint", function () {
    var tslint = require('gulp-tslint');
	
    // Configuration options adapted from TypeScript project:
    // https://github.com/Microsoft/TypeScript/blob/master/tslint.json
	
    var config = {
        "rules": {
            "class-name": true,
            "comment-format": [true,
                "check-space"
            ],
            "indent": [true,
                "spaces"
            ],
            "one-line": [true,
                "check-open-brace"
            ],
            "no-unreachable": true,
            "no-unused-variable": true,
            "no-use-before-declare": true,
            "quotemark": [true,
                "double"
            ],
            "semicolon": true,
            "whitespace": [true,
                "check-branch",
                "check-operator",
                "check-separator",
                "check-type"
            ],
            "typedef-whitespace": [true, {
                "call-signature": "nospace",
                "index-signature": "nospace",
                "parameter": "nospace",
                "property-declaration": "nospace",
                "variable-declaration": "nospace"
            }]
        }
    }

    return gulp.src([sourcePath + tsFiles, testPath + tsFiles])
        .pipe(tslint({ configuration: config }))
        .pipe(tslint.report("verbose"));
});

gulp.task("clean", function () {
    var del = require("del");
    return del([binPath + "/**"], { force: true });
});

gulp.task("default", function (callback) {
    var runSequence = require("run-sequence");
    runSequence("clean", "compile", "tslint", callback);
}); 
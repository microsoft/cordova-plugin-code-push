var gulp = require("gulp");
var path = require("path");
var child_process = require("child_process");
var runSequence = require("run-sequence");

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

function executeCommand(command, args, callback) {
    var process = child_process.exec(command + " " + args.join(" "));

    process.stdout.on('data', function(data) {
        console.log("" + data);
    });
    
    process.stderr.on('data', function(data) {
        console.error("" + data);
    });
    
    process.on('exit', function(code) {
        callback(code === 0 ? undefined : "Error code: " + code);
    });
};

function runTests(callback, android, ios, uiwebview, wkwebview, core) {
    var command = "mocha";
    var args = ["./bin/test"];
    if (android) args.push("--android");
    if (ios) {
        args.push("--ios");
        args.push("--use-wkwebview");
        args.push(wkwebview ? (uiwebview ? "both" : "true") : "false");
    }
    if (core) args.push("--core-tests");
    executeCommand(command, args, callback);
}

gulp.task("compile", function (callback) {
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
    runSequence("clean", "compile", "tslint", callback);
});

gulp.task("test-ios", function (callback) {
    runTests(callback, false, true, true, true);
});

gulp.task("test-ios-uiwebview", function (callback) {
    runTests(callback, false, true, true, false);
});

gulp.task("test-ios-wkwebview", function (callback) {
    runTests(callback, false, true, false, true);
});

gulp.task("test-android", function (callback) {
    runTests(callback, true);
});

gulp.task("test-fast", function (callback) {
    runTests(callback, true, true, true, true);
});

gulp.task("test", function (callback) {
    runSequence("default", "test-fast", callback);
});

gulp.task("test-core-fast", function (callback) {
    runTests(callback, true, true, true, true, true);
});

gulp.task("test-core", function (callback) {
    runSequence("default", "test-core-fast", callback);
});
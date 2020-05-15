var child_process = require("child_process");
var del = require("del");
var gulp = require("gulp");
var path = require("path");
var Q = require("q");

var sourcePath = "./www";
var testPath = "./test";
var binPath = "./bin";
var tsFiles = "/**/*.ts";

var iOSSimulatorProcessName = "Simulator";
var emulatorReadyCheckDelay = 30 * 1000;
var emulatorMaxReadyAttempts = 5;

/* This message is appended to the compiled JS files to avoid contributions to the compiled sources.*/
var compiledSourceWarningMessage = "\n \
/******************************************************************************************** \n \
	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. \n \
	 PLEASE DO NOT MODIFY THIS FILE DIRECTLY AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. \n \
	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER, AND THEN RUN GULP. \n \
	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.md. \n \
*********************************************************************************************/ \n\n\n";

/* TypeScript compilation parameters */
var tsCompileOptions = {
    "noImplicitAny": true,
    "noEmitOnError": true,
    "target": "ES5",
    "module": "commonjs",
    "sourceMap": false,
    "removeComments": true
};

function spawnCommand(command, args, callback, silent, detached) {
    var options = {};
    if (detached) {
        options.detached = true;
        options.stdio = ["ignore"];
    }

    var process = child_process.spawn(command, args, options);

    process.stdout.on('data', function (data) {
        if (!silent) console.log("" + data);
    });

    process.stderr.on('data', function (data) {
        if (!silent) console.error("" + data);
    });

    if (!detached) {
        process.on('exit', function (code) {
            callback && callback(code === 0 ? undefined : "Error code: " + code);
        });
    }

    return process;
};

function execCommand(command, args, callback, silent) {
    var process = child_process.exec(command + " " + args.join(" "));

    process.stdout.on('data', function (data) {
        if (!silent) console.log("" + data);
    });

    process.stderr.on('data', function (data) {
        if (!silent) console.error("" + data);
    });

    process.on('error', function (error) {
        callback && callback(error);
    })

    process.on('exit', function (code) {
        callback && callback(code === 0 ? undefined : "Error code: " + code);
    });

    return process;
};

/**
 * Executes a child process and returns its output in the promise as a string
 */
function execCommandWithPromise(command, options, logOutput) {
    var deferred = Q.defer();

    options = options || {};
    options.maxBuffer = 1024 * 500;
    // abort processes that run longer than five minutes
    options.timeout = 5 * 60 * 1000;

    console.log("Running command: " + command);
    child_process.exec(command, options, (error, stdout, stderr) => {

        if (logOutput) stdout && console.log(stdout);
        stderr && console.error(stderr);

        if (error) {
            console.error(error);
            deferred.reject(error);
        } else {
            deferred.resolve(stdout.toString());
        }
    });

    return deferred.promise;
}

function runTests(callback, options) {
    var command = "node_modules/.bin/mocha";
    var args = ["./bin/test"];

    // Set up the mocha junit reporter.
    args.push("--reporter");
    args.push("mocha-junit-reporter");

    // Set the mocha reporter to the correct output file.
    args.push("--reporter-options");
    var filename = "./test-results.xml";
    if (options.android && !options.ios) filename = "./test-android.xml";
    else if (options.ios && !options.android) filename = "./test-ios" + (options.wk ? (options.ui ? "" : "-wk") : "-ui") + ".xml";
    args.push("mochaFile=" + filename);
    // Delete previous test result file so TFS doesn't read the old file if the tests exit before saving
    del(filename);

    // Pass arguments supplied by test tasks.
    if (options.android) args.push("--android");
    if (options.ios) {
        args.push("--ios");
        args.push("--use-wkwebview");
        args.push(options.wk ? (options.ui ? "both" : "true") : "false");
    }
    if (options.setup) args.push("--setup");

    // Pass arguments from command line.
    // The fourth argument is the first argument after the task name.
    for (var i = 3; i < process.argv.length; i++) {
        args.push(process.argv[i]);
    }

    execCommand(command, args, callback);
}

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

gulp.task("compile", gulp.series("compile-src", "compile-test"));

gulp.task("tslint", function () {
    var tslint = require('gulp-tslint');

    // Configuration options adapted from TypeScript project:
    // https://github.com/Microsoft/TypeScript/blob/master/tslint.json

    return gulp.src([sourcePath + tsFiles, testPath + tsFiles])
        .pipe(tslint({ configuration: "./tslint.json", formatter: "verbose" }))
        .pipe(tslint.report());
});

gulp.task("clean", function () {
    return del([binPath + "/**"], { force: true });
});

gulp.task("default", gulp.series("clean", "compile", "tslint"));

////////////////////////////////////////////////////////////////////////
// Test Tasks //////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////
// Standalone Tasks
//
// Run the tests without setting up the test projects.
// Don't run these without running a setup task first!

// Run on Android standalone
gulp.task("test-run-android", function (callback) {
    var options = {
        android: true
    };

    runTests(callback, options);
});

// Run on iOS with the UiWebView standalone
gulp.task("test-run-ios-ui", function (callback) {
    var options = {
        ios: true,
        ui: true,
    };

    runTests(callback, options);
});

// Run on iOS with the WkWebView standalone
gulp.task("test-run-ios-wk", function (callback) {
    var options = {
        ios: true,
        wk: true,
    };

    runTests(callback, options);
});

////////////////////////////////////////////////////////////////////////
// Setup Tasks
//
// Sets up the test project directories that the tests use and starts emulators.
// Must run before running a standalone suite of tests!

// Sets up the test projects and starts an Android emulator
gulp.task("test-setup-android", function (callback) {
    var options = {
        setup: true,
        android: true
    };

    runTests(callback, options);
});

// Sets up the test projects and starts an iOS emulator
gulp.task("test-setup-ios", function (callback) {
    var options = {
        setup: true,
        ios: true
    };

    runTests(callback, options);
});

// Sets up the test projects and starts both emulators
gulp.task("test-setup-both", function (callback) {
    var options = {
        setup: true,
        android: true,
        ios: true
    };

    runTests(callback, options);
});

// Builds, sets up test projects, and starts the Android emulator
gulp.task("test-setup-build-android", gulp.series("default", "test-setup-android"));

// Builds, sets up test projects, and starts the iOS emulator
gulp.task("test-setup-build-ios", gulp.series("default", "test-setup-ios"));

// Builds, sets up test projects, and starts both emulators
gulp.task("test-setup-build-both", gulp.series("default", "test-setup-both"));

////////////////////////////////////////////////////////////////////////
// Fast Test Tasks
//
// Runs tests but doesn't build or start emulators.

// Run on Android fast
gulp.task("test-android-fast", gulp.series("test-setup-android", "test-run-android"));

// Run on iOS with the UiWebView fast
gulp.task("test-ios-ui-fast", gulp.series("test-setup-ios", "test-run-ios-ui"));

// Run on iOS with the WkWebView fast
gulp.task("test-ios-wk-fast", gulp.series("test-setup-ios", "test-run-ios-wk"));

////////////////////////////////////////////////////////////////////////
// Fast Composition Test Tasks
//
// Run tests but doesn't build or start emulators.

// Run on iOS with the UiWebView fast
gulp.task("test-android-ios-ui-fast", gulp.series("test-setup-both", "test-run-android", "test-run-ios-ui"));

// Run on iOS with the WkWebView fast
gulp.task("test-android-ios-wk-fast", gulp.series("test-setup-both", "test-run-android", "test-run-ios-wk"));

// Run on iOS with both WebViews fast
gulp.task("test-ios-fast", gulp.series("test-setup-ios", "test-run-ios-ui", "test-run-ios-wk"));

// Run on iOS with the WkWebView fast
gulp.task("test-fast", gulp.series("test-setup-both", "test-run-android", "test-run-ios-ui", "test-run-ios-wk"));

////////////////////////////////////////////////////////////////////////
// Test Tasks
//
// Run tests, build, and start emulators.

// Run on Android
gulp.task("test-android", gulp.series("test-setup-build-android", "test-run-android"));

// Run on iOS with the UiWebView
gulp.task("test-ios-ui", gulp.series("test-setup-build-ios", "test-run-ios-ui"));

// Run on iOS with the WkWebView
gulp.task("test-ios-wk", gulp.series("test-setup-build-ios", "test-run-ios-wk"));

////////////////////////////////////////////////////////////////////////
// Composition Test Tasks
//
// Run tests, build, and start emulators.

// Run on Android and iOS with UiWebViews
gulp.task("test-android-ios-ui", gulp.series("test-setup-build-both", "test-run-android", "test-run-ios-ui"));

// Run on Android and iOS with WkWebViews
gulp.task("test-android-ios-wk", gulp.series("test-setup-build-both", "test-run-android", "test-run-ios-wk"));

// Run on iOS with both WebViews
gulp.task("test-ios", gulp.series("test-setup-build-ios", "test-run-ios-ui", "test-run-ios-wk"));

// Run on Android and iOS with both WebViews
gulp.task("test", gulp.series("test-setup-build-both", "test-run-android", "test-run-ios-ui", "test-run-ios-wk"));
var gulp = require("gulp");
var path = require("path");
var child_process = require("child_process");
var runSequence = require("run-sequence");

var sourcePath = "./www";
var testPath = "./test";
var binPath = "./bin";
var tsFiles = "/**/*.ts";

var androidEmulatorName = "emulator";
var iOSEmulatorName = "iPhone 6s Plus (9.3) [";
var iOSSimulatorProcessName = "Simulator";
var emulatorReadyCheckDelay = 30 * 1000;
var emulatorMaxReadyAttempts = 5;

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

function executeCommand(command, args, callback, silent, detached) {
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

function runTests(callback, options) {
    var command = "mocha";
    var args = ["./bin/test"];
    if (options.android) args.push("--android");
    if (options.ios) {
        args.push("--ios");
        args.push("--use-wkwebview");
        args.push(options.wkwebview ? (options.uiwebview ? "both" : "true") : "false");
    }
    if (options.core) args.push("--core-tests");
    if (options.npm) args.push("--npm");
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

function startEmulators(callback, restartIfRunning) {
    // called when an emulator is initialized successfully
    var emulatorsInit = 0;
    function onEmulatorInit(emulator) {
        ++emulatorsInit;
        console.log(emulator + " emulator is ready!");
        if (emulatorsInit === 2) {
            console.log("All emulators are ready!");
            callback(undefined);
        }
    }
    
    // called to check if an Android emulator is initialized
    function androidEmulatorReady(onFailure) {
        console.log("Checking if Android emulator is ready yet...");
        // dummy command that succeeds if emulator is ready and fails otherwise
        executeCommand("adb", ["shell", "pm", "list", "packages"], (code) => {
            if (!code) return onEmulatorInit("Android");
            else {
                console.log("Android emulator is not ready yet!");
                return onFailure();
            }
        }, true);
    }
    // called to check if an iOS emulator is initialized
    function iOSEmulatorReady(onFailure) {
        console.log("Checking if iOS emulator is ready yet...");
        // dummy command that succeeds if emulator is ready and fails otherwise
        executeCommand("xcrun", ["simctl", "getenv", "booted", "asdf"], (code) => {
            if (!code) return onEmulatorInit("iOS");
            else {
                console.log("iOS emulator is not ready yet!");
                return onFailure();
            }
        }, true);
    }
    // kills the Android emulator then starts it
    function killThenStartAndroid() {
        executeCommand("adb", ["emu", "kill"], () => {
            // emulator @emulator, which starts the android emulator, never returns, so we must check its success on another thread
            executeCommand("emulator", ["@emulator"], undefined, false, true);
        
            var emulatorReadyAttempts = 0;
            function androidEmulatorReadyLooper() {
                ++emulatorReadyAttempts;
                if (emulatorReadyAttempts > emulatorMaxReadyAttempts)
                {
                    console.log("Android emulator is not ready after " + emulatorMaxReadyAttempts + " attempts, abort.");
                    androidProcess.kill();
                    return callback(1);
                }
                setTimeout(androidEmulatorReady.bind(undefined, androidEmulatorReadyLooper), emulatorReadyCheckDelay);
            }
            androidEmulatorReadyLooper();
        }, true);
    }
    // kills the iOS emulator then starts it
    function killThenStartIOS() {
        executeCommand("killall", ["\"" + iOSSimulatorProcessName + "\""], () => {
            executeCommand("xcrun", ["instruments", "-w", iOSEmulatorName], () => {
                var emulatorReadyAttempts = 0;
                function iOSEmulatorReadyLooper() {
                    ++emulatorReadyAttempts;
                    if (emulatorReadyAttempts > emulatorMaxReadyAttempts)
                    {
                        console.log("iOS emulator is not ready after " + emulatorMaxReadyAttempts + " attempts, abort.");
                        return callback(1);
                    }
                    setTimeout(iOSEmulatorReady.bind(undefined, iOSEmulatorReadyLooper), emulatorReadyCheckDelay);
                }
                iOSEmulatorReadyLooper();
            });
        }, true);
    }
    if (!restartIfRunning) {
        androidEmulatorReady(() => {
            killThenStartAndroid();
        });
        iOSEmulatorReady(() => {
            killThenStartIOS();
        });
    } else {
        killThenStartAndroid();
        killThenStartIOS();
    }
    // This needs to be done so that the task will exit.
    // The command that creates the Android emulator persists with the life of the emulator and hangs this process unless we force it to quit.
    gulp.doneCallback = (err) => {
        process.exit(err ? 1 : 0);
    }
}

gulp.task("emulator", function (callback) {
    startEmulators(callback, false);
});

gulp.task("emulator-clean", function (callback) {
    startEmulators(callback, true);
});
                
function generateTasks(taskName, options) {
    gulp.task(taskName + "-fast", function (callback) {
        console.log(options);
        runTests(callback, options);
    });
    
    gulp.task(taskName, function (callback) {
        runSequence("default", "emulator", taskName + "-fast", callback);
    });
    
    gulp.task(taskName + "-clean", function (callback) {
        runSequence("default", "emulator-clean", taskName + "-fast", callback);
    });
}

// procedurally generate tasks for every possible testing configuration
var taskNamePrefix = "test";
for (var android = 0; android < 2; android++) {
    // 0 = don't run android tests
    // 1 = run android tests
    for (var ios = 0; ios < 4; ios++) {
        // 0 = don't run iOS tests
        // 1 = run iOS tests on UIWebView
        // 2 = run iOS tests on WKWebView
        // 3 = run iOS tests on both WebViews
        
        // must have at least one platform to be a test
        if (!android && !ios) continue;
        
        for (var core = 0; core < 2; core++) {
            // 0 = run all tests
            // 1 = run only core tests
            for (var npm = 0; npm < 2; npm++) {
                // 0 = run tests on local version of plugin
                // 1 = run tests on version of plugin from npm
                
                var taskName = taskNamePrefix;
                var taskNameSuffix = "";
                if (android) taskNameSuffix += "-android";
                if (ios) taskNameSuffix += "-ios";
                if (ios === 1) taskNameSuffix += "-uiwebview";
                if (ios === 2) taskNameSuffix += "-wkwebview";
                
                // "test" instead of "test-android-ios"
                if (android && ios === 3) taskNameSuffix = "";
                
                if (core) taskNameSuffix += "-core";
                if (npm) taskNameSuffix += "-npm";
                
                taskName += taskNameSuffix;
                
                var options = {};
                if (android) options.android = true;
                if (ios) options.ios = true;
                if (ios % 2 === 1) options.uiwebview = true;
                if (ios >= 2) options.wkwebview = true;
                if (core) options.core = true;
                if (npm) options.npm = true;
                
                console.log(taskName);
                console.log(options);
                
                generateTasks(taskName, options);
            }
        }
    }
}
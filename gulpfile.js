var gulp = require("gulp");
var path = require("path");
var child_process = require("child_process");
var Q = require("q");
var runSequence = require("run-sequence");

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
    
    process.on('error', function (code) {
        callback && callback(code);
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

function getCommandLineFlag(optionName) {
    for (var i = 0; i < process.argv.length; i++) {
        if (process.argv[i].indexOf(optionName) === 0) {
            return true;
        }
    }
    return false;
}

function getCommandLineOption(optionName, defaultValue) {
    for (var i = 0; i < process.argv.length; i++) {
        if (process.argv[i].indexOf(optionName) === 0) {
            if (i + 1 < process.argv.length) {
                return process.argv[i + 1];
            }
            break;
        }
    }
    return defaultValue;
}

function runTests(callback, options) {
    var command = "mocha";
    var args = ["./bin/test"];
    
    // pass arguments supplied by test tasks
    if (options.android) args.push("--android");
    if (options.ios) {
        args.push("--ios");
        args.push("--use-wkwebview");
        args.push(options.wkwebview ? (options.uiwebview ? "both" : "true") : "false");
    }
    if (options.setup) args.push("--setup");
    
    // pass arguments from command line
    // the fourth argument is the first argument after the task name
    for (var i = 3; i < process.argv.length; i++) {
        args.push(process.argv[i]);
    }
    
    execCommand(command, args, callback);
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

////////////////////////////////////////////////////////////////////////
// Emulator Setup Tasks ////////////////////////////////////////////////

function startEmulators(callback, android, ios) {
    var restartIfRunning = getCommandLineFlag("--clean");
    
    if (restartIfRunning) console.log("Restarting emulators");
    
    if (android) {
        var androidEmulatorName = getCommandLineOption("--androidemu", "emulator");
        console.log("Using " + androidEmulatorName + " for Android tests");
        if (!ios) startEmulatorsInternal();
    }

    if (ios) {
        function onReadIOSEmuName() {
            console.log("Using " + iOSEmulatorName + " for iOS tests");
            startEmulatorsInternal();
        }
        
        var iOSEmulatorNameCommandLineOption = getCommandLineOption("--iosemu", undefined);
        if (iOSEmulatorNameCommandLineOption) {
            iOSEmulatorName = iOSEmulatorNameCommandLineOption;
            onReadIOSEmuName();
        } else {
            var iOSEmulatorName = "";
            // get the most recent iOS simulator to run tests on
            execCommandWithPromise("xcrun simctl list")
                .then(function (listOfDevices) {
                    var phoneDevice = /iPhone (\S* )*(\(([0-9A-Z-]*)\))/g;
                    var match = listOfDevices.match(phoneDevice);
                    iOSEmulatorName = match[match.length - 1];
                    onReadIOSEmuName();
                });
        }
    }
    
    function startEmulatorsInternal() {
        // declare platforms that serve as layer of abstraction for platform-specific commands
        var androidPlatform = {};
        androidPlatform.emulatorKill = spawnCommand.bind(undefined, "adb", ["emu", "kill"]);
        androidPlatform.emulatorStart = spawnCommand.bind(undefined, "emulator", ["@" + androidEmulatorName], undefined, false, true);
        androidPlatform.emulatorCheck = spawnCommand.bind(undefined, "adb", ["shell", "pm", "list", "packages"]);
        androidPlatform.name = "Android";
        androidPlatform.emulatorReadyAttempts = 0;
        var iOSPlatform = {};
        iOSPlatform.emulatorKill = spawnCommand.bind(undefined, "killall", [iOSSimulatorProcessName]);
        iOSPlatform.emulatorStart = spawnCommand.bind(undefined, "xcrun", ["instruments", "-w", iOSEmulatorName], undefined);
        iOSPlatform.emulatorCheck = spawnCommand.bind(undefined, "xcrun", ["simctl", "getenv", "booted", "asdf"]);
        iOSPlatform.name = "iOS";
        iOSPlatform.emulatorReadyAttempts = 0;
        
        // called when an emulator is initialized successfully
        var emulatorsInit = 0;
        function onEmulatorInit(platform) {
            ++emulatorsInit;
            console.log(platform.name + " emulator is ready!");
            if (emulatorsInit === ((android ? 1 : 0) + (ios ? 1 : 0))) {
                console.log("All emulators are ready!");
                callback();
            }
        }
        
        // loops the check for whether or not the emulator for the platform is initialized
        function checkEmulatorReadyLooper(platform) {
            ++platform.emulatorReadyAttempts;
            if (platform.emulatorReadyAttempts > emulatorMaxReadyAttempts)
            {
                console.log(platform.name + " emulator is not ready after " + emulatorMaxReadyAttempts + " attempts, abort.");
                return callback(1);
            }
            setTimeout(checkEmulatorReady.bind(undefined, platform, checkEmulatorReadyLooper), emulatorReadyCheckDelay);
        }
        
        // called to check if the emulator for the platform is initialized
        function checkEmulatorReady(platform, onFailure) {
            console.log("Checking if " + platform.name + " emulator is ready yet...");
            // dummy command that succeeds if emulator is ready and fails otherwise
            platform.emulatorCheck(function (code) {
                if (!code) return onEmulatorInit(platform);
                else {
                    console.log(platform.name + " emulator is not ready yet!");
                    return onFailure(platform);
                }
            }, true);
        }
        
        if (android) {
            var bootMethod = restartIfRunning ? androidPlatform.emulatorKill : checkEmulatorReady.bind(undefined, androidPlatform);
            bootMethod(function () {
                androidPlatform.emulatorStart();
                return checkEmulatorReadyLooper(androidPlatform);
            });
        }
        
        if (ios) {
            var bootMethod = restartIfRunning ? iOSPlatform.emulatorKill : checkEmulatorReady.bind(undefined, iOSPlatform);
            bootMethod(function () {
                iOSPlatform.emulatorStart();
                return checkEmulatorReadyLooper(iOSPlatform);
            });
        }
        
        // This needs to be done so that the task will exit.
        // The command that creates the Android emulator persists with the life of the emulator and hangs this process unless we force it to quit.
        gulp.doneCallback = function (err) {
            process.exit(err ? 1 : 0);
        }
    }
}

function getEmulatorTaskNameSuffix(android, ios) {
    if (!!android === !!ios) return "";
    else if (android) return "-android";
    else return "-ios";
}

var emulatorTaskNamePrefix = "emulator";
for (var android = 0; android < 2; android++) {
    for (var ios = 0; ios < 2; ios++) {
        if (!android && !ios) continue;
        
        ((android, ios) => {
            gulp.task(emulatorTaskNamePrefix + getEmulatorTaskNameSuffix(android, ios), function (callback) {
                startEmulators(callback, android, ios);
            });
        })(android, ios);
    }
}

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
gulp.task("test-run-ios-uiwebview", function (callback) {
    var options = {
        ios: true,
        uiwebview: true,
    };
    
    runTests(callback, options);
});

// Run on iOS with the WkWebView standalone
gulp.task("test-run-ios-wkwebview", function (callback) {
    var options = {
        ios: true,
        wkwebview: true,
    };
    
    runTests(callback, options);
});

////////////////////////////////////////////////////////////////////////
// Setup Tasks
//
// Sets up the test project directories that the tests use.
// Must run before running a standalone suite of tests!

// Sets up the test projects
gulp.task("test-setup", function (callback) {
    var options = {
        setup: true
    };
    
    runTests(callback, options);
});

// Sets up test projects and starts the Android emulator
gulp.task("test-setup-android", ["test-setup", "emulator-android"]);

// Sets up test projects and starts the iOS emulator
gulp.task("test-setup-ios", ["test-setup", "emulator-ios"]);

// Sets up test projects and starts both emulators
gulp.task("test-setup-both", ["test-setup", "emulator"]);

// Builds, then sets up the test projects
gulp.task("test-setup-build", ["default"], function (callback) {
    runSequence("test-setup", callback);
});

// Builds, sets up test projects, and starts the Android emulator
gulp.task("test-setup-build-android", ["test-setup-build", "emulator-android"]);

// Builds, sets up test projects, and starts the iOS emulator
gulp.task("test-setup-build-ios", ["test-setup-build", "emulator-ios"]);

// Builds, sets up test projects, and starts both emulators
gulp.task("test-setup-build-both", ["test-setup-build", "emulator"]);

////////////////////////////////////////////////////////////////////////
// Fast Test Tasks
//
// Runs tests but doesn't build or start emulators.

// Run on Android fast
gulp.task("test-android-fast", ["test-setup-android"], function (callback) {
    runSequence("test-run-android", callback);
});

// Run on iOS with the UiWebView fast
gulp.task("test-ios-uiwebview-fast", ["test-setup-ios"], function (callback) {
    runSequence("test-run-ios-uiwebview", callback);
});

// Run on iOS with the WkWebView fast
gulp.task("test-ios-wkwebview-fast", ["test-setup-ios"], function (callback) {
    runSequence("test-run-ios-wkwebview", callback);
});

////////////////////////////////////////////////////////////////////////
// Fast Composition Test Tasks
//
// Run tests but doesn't build or start emulators.

// Run on iOS with the UiWebView fast
gulp.task("test-android-ios-uiwebview-fast", ["test-setup-both"], function (callback) {
    runSequence("test-run-android", "test-run-ios-uiwebview", callback);
});

// Run on iOS with the WkWebView fast
gulp.task("test-android-ios-wkwebview-fast", ["test-setup-both"], function (callback) {
    runSequence("test-run-android", "test-run-ios-wkwebview", callback);
});

// Run on iOS with both WebViews fast
gulp.task("test-ios-fast", ["test-setup-ios"], function (callback) {
    runSequence("test-run-ios-uiwebview", "test-run-ios-wkwebview", callback);
});

// Run on iOS with the WkWebView fast
gulp.task("test-fast", ["test-setup-both"], function (callback) {
    runSequence("test-run-android", "test-run-ios-uiwebview", "test-run-ios-wkwebview", callback);
});

////////////////////////////////////////////////////////////////////////
// Test Tasks
//
// Run tests, build, and start emulators.

// Run on Android
gulp.task("test-android", ["test-setup-build-android"], function (callback) {
    runSequence("test-run-android", callback);
});

// Run on iOS with the UiWebView
gulp.task("test-ios-uiwebview", ["test-setup-build-ios"], function (callback) {
    runSequence("test-run-ios-uiwebview", callback);
});

// Run on iOS with the WkWebView
gulp.task("test-ios-wkwebview", ["test-setup-build-ios"], function (callback) {
    runSequence("test-run-ios-wkwebview", callback);
});

////////////////////////////////////////////////////////////////////////
// Composition Test Tasks
//
// Run tests, build, and start emulators.

// Run on Android and iOS with UiWebViews
gulp.task("test-android-ios-uiwebview", ["test-setup-build-both"], function (callback) {
    runSequence("test-run-android", "test-run-ios-uiwebview", callback);
});

// Run on Android and iOS with WkWebViews
gulp.task("test-android-ios-wkwebview", ["test-setup-build-both"], function (callback) {
    runSequence("test-run-android", "test-run-ios-wkwebview", callback);
});

// Run on iOS with both WebViews
gulp.task("test-ios", ["test-setup-build-ios"], function (callback) {
    runSequence("test-run-ios-uiwebview", "test-run-ios-wkwebview", callback);
});

// Run on Android and iOS with both WebViews
gulp.task("test", ["test-setup-build-both"], function (callback) {
    runSequence("test-run-android", "test-run-ios-uiwebview", "test-run-ios-wkwebview", callback);
});
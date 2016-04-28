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
    if (options.android) args.push("--android");
    if (options.ios) {
        args.push("--ios");
        args.push("--use-wkwebview");
        args.push(options.wkwebview ? (options.uiwebview ? "both" : "true") : "false");
    }
    if (options.core || getCommandLineFlag("--core")) args.push("--core");
    if (options.npm || getCommandLineFlag("--npm")) args.push("--npm");
    if (options.nosetup) args.push("--no-setup");
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
        gulp.task(emulatorTaskNamePrefix + getEmulatorTaskNameSuffix(android, ios), function (callback) {
            startEmulators(callback, android, ios);
        });
    }
}

////////////////////////////////////////////////////////////////////////
// Test Tasks //////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////

// Fast Test Tasks
//
// Runs tests but does not build or start emulators

// Run on Android fast
gulp.task("test-android-fast", function (callback) {
    var options = {
        android: true,
    };
    
    runTests(callback, options);
});

// Run on iOS with the UiWebView fast
gulp.task("test-ios-uiwebview-fast", function (callback) {
    var options = {
        ios: true,
        uiwebview: true,
    };
    
    runTests(callback, options);
});

// Run on iOS with the WkWebView fast
gulp.task("test-ios-wkwebview-fast", function (callback) {
    var options = {
        ios: true,
        wkwebview: true,
    };
    
    runTests(callback, options);
});

// No-Setup Test Tasks
//
// Does not set up the test project directories.
// Must be run after a test that does set up a project directory!

// Run on iOS with the UiWebView with no setup
gulp.task("test-ios-uiwebview-no-setup", function (callback) {
    var options = {
        ios: true,
        uiwebview: true,
        nosetup: true
    };
    
    runTests(callback, options);
});

// Run on iOS with the WkWebView with no setup
gulp.task("test-ios-wkwebview-no-setup", function (callback) {
    var options = {
        ios: true,
        wkwebview: true,
        nosetup: true
    };
    
    runTests(callback, options);
});

// Fast Composition Test Tasks
//
// Runs tests on multiple platforms.
// Does not build or start emulators.

// Run on iOS with both WebViews fast
gulp.task("test-ios-fast", function (callback) {
    runSequence("test-ios-uiwebview-fast", "test-ios-wkwebview-no-setup", callback);
});

// Run on Android and iOS with the UiWebView fast
gulp.task("test-android-ios-uiwebview-fast", function (callback) {
    runSequence("test-android-fast", "test-ios-uiwebview-no-setup", callback);
});

// Run on Android and iOS with the WkWebView fast
gulp.task("test-android-ios-wkwebview-fast", function (callback) {
    runSequence("test-android-fast", "test-ios-wkwebview-no-setup", callback);
});

// Run on Android and iOS with both WebViews fast
gulp.task("test-fast", function (callback) {
    runSequence("test-android-ios-uiwebview-fast", "test-ios-wkwebview-no-setup", callback);
});

// Test Tasks
//
// Runs tests and builds and starts emulators

// Run on Android
gulp.task("test-android", function (callback) {
    runSequence("default", "emulator-android", "test-android-fast", callback);
});

// Run on iOS with the UiWebView
gulp.task("test-ios-uiwebview", function (callback) {
    runSequence("default", "emulator-ios", "test-ios-uiwebview-fast", callback);
});

// Run on iOS with the WkWebView
gulp.task("test-ios-wkwebview", function (callback) {
    runSequence("default", "emulator-ios", "test-ios-wkwebview-fast", callback);
});

// Run on iOS with both WebViews
gulp.task("test-ios", function (callback) {
    runSequence("default", "emulator-ios", "test-ios-fast", callback);
});

// Run on Android and iOS with the UiWebView
gulp.task("test-android-ios-uiwebview", function (callback) {
    runSequence("default", "emulator", "test-android-ios-uiwebview-fast", callback);
});

// Run on Android and iOS with the WkWebView
gulp.task("test-android-ios-wkwebview", function (callback) {
    runSequence("default", "emulator", "test-android-ios-wkwebview-fast", callback);
});

// Run on Android and iOS with both WebViews
gulp.task("test", function (callback) {
    runSequence("default", "emulator", "test-fast", callback);
});
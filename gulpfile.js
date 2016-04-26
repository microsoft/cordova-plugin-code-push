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

function runTests(callback, options) {
    var command = "mocha";
    var args = ["./bin/test"];
    if (options.android) args.push("--android");
    if (options.ios) {
        args.push("--ios");
        args.push("--use-wkwebview");
        args.push(options.wkwebview ? (options.uiwebview ? "both" : "true") : "false");
    }
    if (options.core) args.push("--core");
    if (options.npm) args.push("--npm");
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

function startEmulators(callback, restartIfRunning, android, ios) {
    if (android) {
        var androidEmulatorOptionName = "--androidemu";
        var androidEmulatorName = "emulator";
        // get the Android emulator from the arguments to run tests on
        for (var i = 0; i < process.argv.length; i++) {
            if (process.argv[i].indexOf(androidEmulatorOptionName) === 0) {
                if (i + 1 < process.argv.length) {
                    androidEmulatorName = process.argv[i + 1];
                }
                break;
            }
        }
        console.log("Using " + androidEmulatorName + " for Android tests");
    }

    if (ios) {
        var iOSEmulatorName = "";
        // get the most recent iOS simulator to run tests on
        execCommandWithPromise("xcrun simctl list")
            .then(function (listOfDevices) {
                var phoneDevice = /iPhone (\S* )*(\(([0-9A-Z-]*)\))/g;
                var match = listOfDevices.match(phoneDevice);
                iOSEmulatorName = match[match.length - 1];
                console.log("Using " + iOSEmulatorName + " for iOS tests");
            }, function () { return null; })
            .then(function () {
                return startEmulatorsInternal();
            });
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
    
    if (!ios) startEmulatorsInternal();
}

// procedurally generate tasks for every possible testing configuration
var cleanSuffix = "-clean";
var fastSuffix = "-fast";

// generate tasks for starting emulators
function generateEmulatorTasks(taskName, android, ios) {
    gulp.task(taskName, function (callback) {
        startEmulators(callback, false, android, ios);
    });
    
    gulp.task(taskName + cleanSuffix, function (callback) {
        startEmulators(callback, true, android, ios);
    });
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
        generateEmulatorTasks(emulatorTaskNamePrefix + getEmulatorTaskNameSuffix(android, ios), android, ios);
    }
}
                
function generateTestTasks(taskName, options) {
    gulp.task(taskName + "-fast", function (callback) {
        runTests(callback, options);
    });
    
    var emulatorTaskName = emulatorTaskNamePrefix + getEmulatorTaskNameSuffix(options.android, options.ios);
    
    gulp.task(taskName, function (callback) {
        runSequence("default", emulatorTaskName, taskName + fastSuffix, callback);
    });
    
    gulp.task(taskName + "-clean", function (callback) {
        runSequence("default", emulatorTaskName + cleanSuffix, taskName + fastSuffix, callback);
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
                
                var options = {
                    android: !!android,
                    ios: !!ios,
                    uiwebview: ios % 2 == 1,
                    wkwebview: ios >= 2,
                    core: !!core,
                    npm: !!npm
                };
                
                var taskName = taskNamePrefix;
                // test instead of test-android-ios
                if (!(options.android && options.ios && options.uiwebview && options.wkwebview)) {
                    options.android && (taskName += "-android");
                    options.ios && (taskName += "-ios");
                    // test-ios instead of test-ios-uiwebview-wkwebview
                    options.uiwebview && !options.wkwebview && (taskName += "-uiwebview");
                    options.wkwebview && !options.uiwebview && (taskName += "-wkwebview");
                }
                
                options.core && (taskName += "-core");
                options.npm && (taskName += "-npm");
                
                generateTestTasks(taskName, options);
            }
        }
    }
}
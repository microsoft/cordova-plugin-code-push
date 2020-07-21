/// <reference types="mocha" />
/// <reference types="node" />

"use strict";

import child_process = require("child_process");
import os = require("os");
import fs = require("fs");
import path = require("path");
import Q = require("q");

export class TestUtil {
    public static ANDROID_PLATFORM_OPTION_NAME: string = "--android";
    public static ANDROID_SERVER_URL: string = "--androidserver";
    public static ANDROID_EMULATOR: string = "--androidemu";
    public static IOS_PLATFORM_OPTION_NAME: string = "--ios";
    public static IOS_SERVER_URL: string = "--iosserver";
    public static IOS_EMULATOR: string = "--iosemu";
    public static RESTART_EMULATORS: string = "--clean";
    public static SHOULD_USE_WKWEBVIEW: string = "--use-wkwebview";
    public static TEST_RUN_DIRECTORY: string = "--test-directory";
    public static TEST_UPDATES_DIRECTORY: string = "--updates-directory";
    public static CORE_TESTS_ONLY: string = "--core";
    public static PULL_FROM_NPM: string = "--npm";
    public static SETUP: string = "--setup";
    
    public static templatePath = path.join(__dirname, "../../test/template");
    
    public static thisPluginPath = path.join(__dirname, "../..");
    
    public static defaultAndroidServerUrl = "http://10.0.2.2:3001";
    public static defaultIOSServerUrl = "http://127.0.0.1:3000";
    
    public static defaultAndroidEmulator = "emulator";
    
    private static defaultTestRunDirectory = path.join(os.tmpdir(), "cordova-plugin-code-push", "test-run");
    private static defaultUpdatesDirectory = path.join(os.tmpdir(), "cordova-plugin-code-push", "updates");
    
    /**
     * Reads the directory in which the test project is.
     */
    public static readTestRunDirectory(): string {
        var commandLineOption = TestUtil.readMochaCommandLineOption(TestUtil.TEST_RUN_DIRECTORY);
        var testRunDirectory = commandLineOption ? commandLineOption : TestUtil.defaultTestRunDirectory;
        console.log("testRunDirectory = " + testRunDirectory);
        return testRunDirectory;
    }
    
    /**
     * Reads the directory in which the test project for updates is.
     */
    public static readTestUpdatesDirectory(): string {
        var commandLineOption = TestUtil.readMochaCommandLineOption(TestUtil.TEST_UPDATES_DIRECTORY);
        var testUpdatesDirectory = commandLineOption ? commandLineOption : TestUtil.defaultUpdatesDirectory;
        console.log("testUpdatesDirectory = " + testUpdatesDirectory);
        return testUpdatesDirectory;
    }
    
    /**
     * Reads the path of the plugin (whether or not we should use the local copy or pull from npm)
     */
    public static readPluginPath(): string {
        var commandLineFlag = TestUtil.readMochaCommandLineFlag(TestUtil.PULL_FROM_NPM);
        var pluginPath = commandLineFlag ? "cordova-plugin-code-push" : TestUtil.thisPluginPath;
        console.log("pluginPath = " + pluginPath);
        return pluginPath;
    }
    
    /**
     * Reads the Android server url to use
     */
    public static readAndroidServerUrl(): string {
        var commandLineOption = TestUtil.readMochaCommandLineOption(TestUtil.ANDROID_SERVER_URL);
        var androidServerUrl = commandLineOption ? commandLineOption : TestUtil.defaultAndroidServerUrl;
        console.log("androidServerUrl = " + androidServerUrl);
        return androidServerUrl;
    }
    
    /**
     * Reads the iOS server url to use
     */
    public static readIOSServerUrl(): string {
        var commandLineOption = TestUtil.readMochaCommandLineOption(TestUtil.IOS_SERVER_URL);
        var iOSServerUrl = commandLineOption ? commandLineOption : TestUtil.defaultIOSServerUrl;
        return iOSServerUrl;
    }

    /**
     * Reads the Android emulator to use
     */
    public static readAndroidEmulator(): Q.Promise<string> {
        var deferred = Q.defer<string>();
        
        function onReadAndroidEmuName(androidEmulatorName: string) {
            console.log("Using " + androidEmulatorName + " for Android tests");
            deferred.resolve(androidEmulatorName);
        }
            
        var commandLineOption = TestUtil.readMochaCommandLineOption(TestUtil.ANDROID_EMULATOR);
        if (commandLineOption) {
            onReadAndroidEmuName(commandLineOption);
        } else {
            // get the most recent iOS simulator to run tests on
            this.getProcessOutput("emulator -list-avds")
                .then(function (Devices) {
                    const listOfDevices = Devices.trim().split("\n");
                    onReadAndroidEmuName(listOfDevices[listOfDevices.length - 1]);
                })
                .catch((error) => {
                    deferred.reject(error);
                });
        }
                
        return deferred.promise;
    }
    
    /**
     * Reads the iOS emulator to use
     */
    public static readIOSEmulator(): Q.Promise<string> {
        var deferred = Q.defer<string>();
        
        function onReadIOSEmuName(iOSEmulatorName: string) {
            console.log("Using " + iOSEmulatorName + " for iOS tests");
            deferred.resolve(iOSEmulatorName);
        }
            
        var commandLineOption = TestUtil.readMochaCommandLineOption(TestUtil.IOS_EMULATOR);
        if (commandLineOption) {
            onReadIOSEmuName(commandLineOption);
        } else {
            // get the most recent iOS simulator to run tests on
            this.getProcessOutput("xcrun simctl list")
                .then(function (listOfDevicesWithDevicePairs) {
                    var listOfDevices: string = listOfDevicesWithDevicePairs.slice(listOfDevicesWithDevicePairs.indexOf("-- iOS"), listOfDevicesWithDevicePairs.indexOf("-- tvOS"));
                    var phoneDevice = /iPhone (\S* )*(\(([0-9A-Z-]*)\))/g;
                    var match = listOfDevices.match(phoneDevice);
                    onReadIOSEmuName(match[match.length - 1]);
                })
                .catch(() => {
                    deferred.reject(undefined);
                });
        }
                
        return deferred.promise;
    }
    
    /**
     * Reads whether or not emulators should be restarted.
     */
    public static readRestartEmulators(): boolean {
        var restartEmulators = TestUtil.readMochaCommandLineFlag(TestUtil.RESTART_EMULATORS);
        if (restartEmulators) console.log("restart emulators");
        return restartEmulators;
    }
    
    /**
     * Reads whether or not only core tests should be run.
     */
    public static readCoreTestsOnly(): boolean {
        var coreTestsOnly = TestUtil.readMochaCommandLineFlag(TestUtil.CORE_TESTS_ONLY);
        if (coreTestsOnly) console.log("only core tests");
        return coreTestsOnly;
    }
    /**
     * Copies a file from a given location to another.
     */
    public static copyFile(source: string, destination: string, overwrite: boolean): Q.Promise<void>  {
        var deferred = Q.defer<void>();
        try {
            console.log(`Copy ${source} to ${destination}`);
            
            var errorHandler = function (error: Error) {
                deferred.reject(error);
            };
            if (overwrite && fs.existsSync(destination)) {
                fs.unlinkSync(destination);
            }
            var readStream = fs.createReadStream(source);
            readStream.on("error", errorHandler);
            var writeStream = fs.createWriteStream(destination);
            writeStream.on("error", errorHandler);
            writeStream.on("close", deferred.resolve.bind(undefined, undefined));
            readStream.pipe(writeStream);
        }
        catch (e) {
            deferred.reject(e);
        }
        return deferred.promise;
    }
    
    /**
     * Reads whether or not to setup the test project directories.
     */
    public static readShouldSetup(): boolean {
        var noSetup = TestUtil.readMochaCommandLineFlag(TestUtil.SETUP);
        if (noSetup) console.log("set up test project directories");
        return noSetup;
    }
    
    /**
     * Reads the test target platforms.
     */
    public static readTargetPlatforms(): string[] {
        var platforms: string[] = [];
        if (this.readMochaCommandLineFlag(TestUtil.ANDROID_PLATFORM_OPTION_NAME)) {
            console.log("Android");
            platforms.push("android");
        }
        if (this.readMochaCommandLineFlag(TestUtil.IOS_PLATFORM_OPTION_NAME)) {
            console.log("iOS");
            platforms.push("ios");
        }
        return platforms;
    }
    
    /**
     * Reads if we should use the WkWebView or the UIWebView or run tests for both.
     * 0 for UIWebView, 1 for WkWebView, 2 for both
     */
    public static readShouldUseWkWebView(): number {
        var shouldUseWkWebView = TestUtil.readMochaCommandLineOption(TestUtil.SHOULD_USE_WKWEBVIEW);
        switch (shouldUseWkWebView) {
            case "true":
                console.log("WkWebView");
                return 1;
            case "both":
                console.log("Both WkWebView and UIWebView");
                return 2;
            case "false":
            default:
                return 0;
        }
    }

    /**
	 * Reads command line options passed to mocha.
	 */
    private static readMochaCommandLineOption(optionName: string): string {
        var optionValue: string = undefined;

        for (var i = 0; i < process.argv.length; i++) {
            if (process.argv[i].indexOf(optionName) === 0) {
                if (i + 1 < process.argv.length) {
                    optionValue = process.argv[i + 1];
                }
                break;
            }
        }

        return optionValue;
    }

    /**
	 * Reads command line options passed to mocha.
	 */
    private static readMochaCommandLineFlag(optionName: string): boolean {
        for (var i = 0; i < process.argv.length; i++) {
            if (process.argv[i].indexOf(optionName) === 0) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Executes a child process returns its output as a string.
     */
    public static getProcessOutput(command: string, options?: child_process.ExecOptions, logOutput: boolean = false): Q.Promise<string> {
        var deferred = Q.defer<string>();
        var result = "";

        options = options || {};
        options.maxBuffer = 1024 * 500;

        if (logOutput) {
            console.log("Running command: " + command);
        }

        child_process.exec(command, options, (error: Error, stdout: Buffer, stderr: Buffer) => {

            result += stdout;

            if (logOutput) {
                stdout && console.log(stdout);
            }

            if (logOutput && stderr) {
                console.error("" + stderr);
            }

            if (error) {
                if (logOutput) console.error("" + error);
                deferred.reject(error);
            } else {
                deferred.resolve(result);
            }
        });

        return deferred.promise;
    }
}
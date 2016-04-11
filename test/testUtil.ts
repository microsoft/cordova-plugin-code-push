/// <reference path="../typings/mocha.d.ts" />
/// <reference path="../typings/node.d.ts" />

"use strict";

import child_process = require("child_process");
import os = require("os");
import path = require("path");
import Q = require("q");

export class TestUtil {

    public static MOCK_SERVER_OPTION_NAME: string = "--mockserver";
    public static PLATFORM_OPTION_NAME: string = "--platform";
    public static TARGET_OPTION_NAME: string = "--target";
    public static SHOULD_USE_WKWEBVIEW: string = "--use-wkwebview";
    
    public static templatePath = path.join(__dirname, "../../test/template");
    public static thisPluginPath = path.join(__dirname, "../..");
    public static testRunDirectory = path.join(os.tmpdir(), "cordova-plugin-code-push", "test-run");
    public static updatesDirectory = path.join(os.tmpdir(), "cordova-plugin-code-push", "updates");

    /**
     * Reads the target emulator name.
     */
    public static readTargetEmulator(): string {
        return TestUtil.readMochaCommandLineOption(TestUtil.TARGET_OPTION_NAME);
    }

	/**
	 * Reads the mock CodePush server URL parameter passed to mocha.
	 * The mock server runs on the local machine during tests. 
	 */
    public static readMockServerName(): string {
        return TestUtil.readMochaCommandLineOption(TestUtil.MOCK_SERVER_OPTION_NAME);
    }

    /**
     * Reads the test target platform.
     */
    public static readTargetPlatform(): string {
        return TestUtil.readMochaCommandLineOption(TestUtil.PLATFORM_OPTION_NAME);
    }
    
    /**
     * Reads if we should use the WkWebView or the UIWebView
     */
    public static readShouldUseWkWebView(): boolean {
        var shouldUseWkWebView = TestUtil.readMochaCommandLineOption(TestUtil.SHOULD_USE_WKWEBVIEW);
        return shouldUseWkWebView ? JSON.parse(shouldUseWkWebView) : false;
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
     * Executes a child process returns its output as a string.
     */
    public static getProcessOutput(command: string, options?: child_process.IExecOptions, logOutput: boolean = false): Q.Promise<string> {
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

            if (stderr) {
                console.error("" + stderr);
            }

            if (error) {
                console.error("" + error);
                deferred.reject(error);
            } else {
                deferred.resolve(result);
            }
        });

        return deferred.promise;
    }
}
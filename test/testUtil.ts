/// <reference path="../typings/mocha.d.ts" />
/// <reference path="../typings/node.d.ts" />

"use strict";

export class TestUtil {

    public static MOCK_SERVER_OPTION_NAME: string = "--mockserver";
    public static PLATFORM_OPTION_NAME: string = "--platform";
    public static TARGET_OPTION_NAME: string = "--target";

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
}
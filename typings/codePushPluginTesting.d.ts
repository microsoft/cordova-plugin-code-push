/// <reference path="../typings/q.d.ts" />
/// <reference path="../typings/mocha.d.ts" />
/// <reference path="../typings/node.d.ts" />

// Type definitions for CodePush Plugin Testing Framework Plugin
// Project: https://github.com/Microsoft/code-push
//
// Copyright (c) Microsoft Corporation
// All rights reserved.
// Licensed under the MIT license.

interface IPlatform {
    /**
     * Gets the platform name. (e.g. "android" for the Android platform).
     */
    getName(): string;
    
    /**
     * Gets the server url used for testing.
     */
    getServerUrl(): string;
    
    /**
     * Gets the root of the platform www folder used for creating update packages.
     */
    getPlatformWwwPath(projectDirectory: string): string;
    
    /**
     * Gets an IEmulatorManager that is used to control the emulator during the tests.
     */
    getEmulatorManager(): IEmulatorManager;
    
    /**
     * Gets the default deployment key.
     */
    getDefaultDeploymentKey(): string;
}

/**
 * Manages the interaction with the emulator.
 */
interface IEmulatorManager {
    /**
     * Boots the target emulator.
     */
    bootEmulator(restartEmulators: boolean): Q.Promise<string>;
    
    /**
     * Launches an already installed application by app id.
     */
    launchInstalledApplication(appId: string): Q.Promise<string>;
    
    /**
     * Ends a running application given its app id.
     */
    endRunningApplication(appId: string): Q.Promise<string>;
    
    /**
     * Restarts an already installed application by app id.
     */
    restartApplication(appId: string): Q.Promise<string>;
    
    /**
     * Navigates away from the current app, waits for a delay (defaults to 1 second), then navigates to the specified app.
     */
    resumeApplication(appId: string, delayBeforeResumingMs: number): Q.Promise<string>;
    
    /**
     * Prepares the emulator for a test.
     */
    prepareEmulatorForTest(appId: string): Q.Promise<string>;
    
    /**
     * Uninstalls the app from the emulator.
     */
    uninstallApplication(appId: string): Q.Promise<string>;
}

/**
 * Android implementations of IPlatform.
 */
declare class Android implements IPlatform {
    constructor(emulatorManager: IEmulatorManager);

    public static getInstance(): Android;

    public getName(): string;
    
    /**
     * Gets the server url used for testing.
     */
    public getServerUrl(): string;

    public getPlatformWwwPath(projectDirectory: string): string;

    public getEmulatorManager(): IEmulatorManager;

    public getDefaultDeploymentKey(): string;
}

/**
 * IOS implementation of IPlatform.
 */
declare class IOS implements IPlatform {
    constructor(emulatorManager: IEmulatorManager);

    public static getInstance(): IOS;

    public getName(): string;
    
    public getServerUrl(): string;

    public getPlatformWwwPath(projectDirectory: string): string;

    public getEmulatorManager(): IEmulatorManager;

    public getDefaultDeploymentKey(): string;
}

declare class IOSEmulatorManager implements IEmulatorManager {
    /**
     * Boots the target emulator.
     */
    bootEmulator(restartEmulators: boolean): Q.Promise<string>;
    
    /**
     * Launches an already installed application by app id.
     */
    launchInstalledApplication(appId: string): Q.Promise<string>;
    
    /**
     * Ends a running application given its app id.
     */
    endRunningApplication(appId: string): Q.Promise<string>;
    
    /**
     * Restarts an already installed application by app id.
     */
    restartApplication(appId: string): Q.Promise<string>;
    
    /**
     * Navigates away from the current app, waits for a delay (defaults to 1 second), then navigates to the specified app.
     */
    resumeApplication(appId: string, delayBeforeResumingMs?: number): Q.Promise<string>;
    
    /**
     * Prepares the emulator for a test.
     */
    prepareEmulatorForTest(appId: string): Q.Promise<string>;
    
    /**
     * Uninstalls the app from the emulator.
     */
    uninstallApplication(appId: string): Q.Promise<string>;
}

declare class AndroidEmulatorManager implements IEmulatorManager {
    /**
     * Boots the target emulator.
     */
    bootEmulator(restartEmulators: boolean): Q.Promise<string>;
    
    /**
     * Launches an already installed application by app id.
     */
    launchInstalledApplication(appId: string): Q.Promise<string>;
    
    /**
     * Ends a running application given its app id.
     */
    endRunningApplication(appId: string): Q.Promise<string>;
    
    /**
     * Restarts an already installed application by app id.
     */
    restartApplication(appId: string): Q.Promise<string>;
    
    /**
     * Navigates away from the current app, waits for a delay (defaults to 1 second), then navigates to the specified app.
     */
    resumeApplication(appId: string, delayBeforeResumingMs?: number): Q.Promise<string>;
    
    /**
     * Prepares the emulator for a test.
     */
    prepareEmulatorForTest(appId: string): Q.Promise<string>;
    
    /**
     * Uninstalls the app from the emulator.
     */
    uninstallApplication(appId: string): Q.Promise<string>;
}

/**
 * Supported platforms resolver.
 */
declare class PlatformResolver {;
    /**
     * Given the cordova name of a platform, this method returns the IPlatform associated with it.
     */
    public static resolvePlatforms(cordovaPlatformNames: string[]): IPlatform[];

    /**
     * Given the cordova name of a platform, this method returns the IPlatform associated with it.
     */
    public static resolvePlatform(cordovaPlatformName: string): IPlatform;
}

declare abstract class ProjectManager {
    public static ANDROID_KEY_PLACEHOLDER: string;
    public static IOS_KEY_PLACEHOLDER: string;
    public static SERVER_URL_PLACEHOLDER: string;
    public static INDEX_JS_PLACEHOLDER: string;
    public static CODE_PUSH_APP_VERSION_PLACEHOLDER: string;
    public static CODE_PUSH_APP_ID_PLACEHOLDER: string;
    public static PLUGIN_VERSION_PLACEHOLDER: string;

    public static DEFAULT_APP_VERSION: string;
    
    // ABSTRACT
    
    /**
     * Returns the name of the plugin being tested, ie Cordova or React-Native
     */
    public abstract getPluginName(): string;

	/**
	 * Creates a new test application at the specified path, and configures it
	 * with the given server URL, android and ios deployment keys.
	 */
    public abstract setupProject(projectDirectory: string, templatePath: string, appName: string, appNamespace: string, version?: string): Q.Promise<string>;
    
    /**
     * Sets up the scenario for a test in an already existing project.
     */
    public abstract setupScenario(projectDirectory: string, appId: string, templatePath: string, jsPath: string, targetPlatform: IPlatform, version?: string): Q.Promise<string>;

    /**
     * Creates a CodePush update package zip for a project.
     */
    public abstract createUpdateArchive(projectDirectory: string, targetPlatform: IPlatform, isDiff?: boolean): Q.Promise<string>;
    
    /**
     * Prepares a specific platform for tests.
     */
    public abstract preparePlatform(projectFolder: string, targetPlatform: IPlatform): Q.Promise<string>;
    
    /**
     * Cleans up a specific platform after tests.
     */
    public abstract cleanupAfterPlatform(projectFolder: string, targetPlatform: IPlatform): Q.Promise<string>;

    /**
     * Runs the test app on the given target / platform.
     */
    public abstract runPlatform(projectFolder: string, targetPlatform: IPlatform): Q.Promise<string>;
    
    // EMULATOR MANAGER FUNCTIONS

    /**
     * Launch the test app on the given target / platform.
     */
    public launchApplication(appNamespace: string, targetPlatform: IPlatform): Q.Promise<string>;

    /**
     * Kill the test app on the given target / platform.
     */
    public endRunningApplication(appNamespace: string, targetPlatform: IPlatform): Q.Promise<string>;

    /**
     * Prepares the emulator for a test.
     */
    public prepareEmulatorForTest(appNamespace: string, targetPlatform: IPlatform): Q.Promise<string>;
    
    /**
     * Uninstalls the app from the emulator.
     */
    public uninstallApplication(appNamespace: string, targetPlatform: IPlatform): Q.Promise<string>;

    /**
     * Stops and restarts an application specified by its namespace identifier.
     */
    public restartApplication(appNamespace: string, targetPlatform: IPlatform): Q.Promise<string>;
    
    /**
     * Navigates away from the application and then navigates back to it.
     */
    public resumeApplication(appNamespace: string, targetPlatform: IPlatform, delayBeforeResumingMs?: number): Q.Promise<string>;
    
    // UTILITY FUNCTIONS

    /**
     * Executes a child process and logs its output to the console and returns its output in the promise as a string
     */
    public static execChildProcess(command: string, options?: NodeJSChildProcess.IExecOptions, logOutput?: boolean): Q.Promise<string>;

	/**
	 * Replaces a regex in a file with a given string.
	 */
    public static replaceString(filePath: string, regex: string, replacement: string): void;

    /**
     * Copies a file from a given location to another.
     */
    public static copyFile(source: string, destination: string, overwrite: boolean): Q.Promise<void>;
}

/**
 * Class used to mock the codePush.checkForUpdate() response from the server.
 */
declare class CheckForUpdateResponseMock {
    downloadURL: string;
    isAvailable: boolean;
    packageSize: number;
    updateAppVersion: boolean;
    appVersion: string;
    description: string;
    label: string;
    packageHash: string;
    isMandatory: boolean;
}

/**
 * The model class of the codePush.checkForUpdate() request to the server.
 */
declare class UpdateCheckRequestMock {
    deploymentKey: string;
    appVersion: string;
    packageHash: string;
    isCompanion: boolean;
}

/**
 * Contains all the messages sent from the application to the mock server during tests.
 */
declare class TestMessage {
    public static CHECK_UP_TO_DATE: string;
    public static CHECK_UPDATE_AVAILABLE: string;
    public static CHECK_ERROR: string;
    public static DOWNLOAD_SUCCEEDED: string;
    public static DOWNLOAD_ERROR: string;
    public static UPDATE_INSTALLED: string;
    public static INSTALL_ERROR: string;
    public static DEVICE_READY_AFTER_UPDATE: string;
    public static UPDATE_FAILED_PREVIOUSLY: string;
    public static NOTIFY_APP_READY_SUCCESS: string;
    public static NOTIFY_APP_READY_FAILURE: string;
    public static SKIPPED_NOTIFY_APPLICATION_READY: string;
    public static SYNC_STATUS: string;
    public static RESTART_SUCCEEDED: string;
    public static RESTART_FAILED: string;
    public static PENDING_PACKAGE: string;
    public static CURRENT_PACKAGE: string;

    public static SYNC_UP_TO_DATE: Number;
    public static SYNC_UPDATE_INSTALLED: Number;
    public static SYNC_UPDATE_IGNORED: Number;
    public static SYNC_ERROR: Number;
    public static SYNC_IN_PROGRESS: Number;
    public static SYNC_CHECKING_FOR_UPDATE: Number;
    public static SYNC_AWAITING_USER_ACTION: Number;
    public static SYNC_DOWNLOADING_PACKAGE: Number;
    public static SYNC_INSTALLING_UPDATE: Number;
}

/**
 * Contains all the messages sent from the mock server back to the application during tests.
 */
declare class TestMessageResponse {
    public static SKIP_NOTIFY_APPLICATION_READY: string;
}

/**
 * Defines the messages sent from the application to the mock server during tests.
 */
declare class AppMessage {
    message: string;
    args: any[];

    constructor(message: string, args: any[]);

    static fromString(message: string): AppMessage;
}

/**
 * Checks if two messages are equal.
 */
declare function areEqual(m1: AppMessage, m2: AppMessage): boolean;

declare module PluginTestingFramework {
    //////////////////////////////////////////////////////////////////////////////////////////
    // Use these variables in tests

    // CONST
    const TestAppName: string;
    const TestNamespace: string;
    const AcquisitionSDKPluginName: string;
    
    // NON CONST
    /** Response the server gives the next update check request */
    var updateResponse: any;
    
    /** Response the server gives the next test message request */
    var testMessageResponse: any;
    
    /** Called after the next test message request */
    var testMessageCallback: (requestBody: any) => void;
    
    /** Called after the next update check request */
    var updateCheckCallback: (requestBody: any) => void;
    
    /** Location of the update package given in the update check response */
    var updatePackagePath: string;

    // READ FROM THE COMMAND LINE
    var testUtil: TestUtil;
    var templatePath: string;
    var thisPluginPath: string;
    var testRunDirectory: string;
    var updatesDirectory: string;
    var onlyRunCoreTests: boolean;
    var targetPlatforms: IPlatform[];
    var shouldUseWkWebView: string
    var shouldSetup: boolean;
    var restartEmulators: boolean;
    
    //////////////////////////////////////////////////////////////////////////////////////////
    // Use these classes to create and structure the tests
    
    interface TestBuilder {
        /**
         * Called to create the test suite by the initializeTests function
         * 
         * coreTestsOnly - Whether or not only core tests are to be run
         * projectManager - The projectManager instance that these tests are being run with
         * targetPlatform - The platform that these tests are going to be run on
         */
        create(coreTestsOnly: boolean, projectManager: ProjectManager, targetPlatform: IPlatform): void;
    }
    
    /** Use this class to create a mocha.describe that contains additional tests */
    class TestBuilderDescribe implements TestBuilder {
        /**
         * describeName - used as the description in the call to describe
         * scenarioPath - if specified, will be set up before the tests run
         * testBuilders - the testBuilders to create within this describe call
         */
        constructor(describeName: string, testBuilders: TestBuilder[], scenarioPath?: string);
        
        /**
         * Called to create the test suite by the initializeTests function
         * 
         * coreTestsOnly - Whether or not only core tests are to be run
         * projectManager - The projectManager instance that these tests are being run with
         * targetPlatform - The platform that these tests are going to be run on
         */
        create(coreTestsOnly: boolean, projectManager: ProjectManager, targetPlatform: IPlatform): void;
    }
    
    /** Use this class to create a test through mocha.it */
    class TestBuilderIt implements TestBuilder {
        /**
         * testName - used as the expectation in the call to it
         * test - the test to provide to it
         * isCoreTest - whether or not the test should run when "--core" is supplied
         */
        constructor(testName: string, test: (projectManager: ProjectManager, targetPlatform: IPlatform, done: MochaDone) => void, isCoreTest: boolean);
        
        /**
         * Called to create the test suite by the initializeTests function
         * 
         * coreTestsOnly - Whether or not only core tests are to be run
         * projectManager - The projectManager instance that these tests are being run with
         * targetPlatform - The platform that these tests are going to be run on
         */
        create(coreTestsOnly: boolean, projectManager: ProjectManager, targetPlatform: IPlatform): void;
    }

    //////////////////////////////////////////////////////////////////////////////////////////
    // Use these functions in tests
    
    /**
     * Returns a default empty response to give to the app in a checkForUpdate request
     */
    function createDefaultResponse(): CheckForUpdateResponseMock;

    /**
     * Returns a default update response to give to the app in a checkForUpdate request
     */
    function createMockResponse(mandatory?: boolean): CheckForUpdateResponseMock;
            
    /**
     * Returns a default update response with a download URL and random package hash.
     */
    function getMockResponse(targetPlatform: IPlatform, mandatory?: boolean, randomHash?: boolean): CheckForUpdateResponseMock;
    
    /**
     * Creates an update and zip for the test app using the specified scenario and version
     */
    function createUpdate(projectManager: ProjectManager, targetPlatform: IPlatform, scenarioJsPath: string, version: string): Q.Promise<string>;

    /**
     * Waits for the next set of test messages sent by the app and asserts that they are equal to the expected messages
     */
    function verifyMessages(expectedMessages: (string | AppMessage)[], deferred: Q.Deferred<void>): (requestBody: any) => void;
    
    //////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Call this function with a ProjectManager and an array of TestBuilderDescribe objects to run tests
     */
    function initializeTests(projectManager: ProjectManager, tests: TestBuilderDescribe[]): void;
}

declare class TestUtil {
    
    // COMMAND LINE OPTION NAMES, FLAGS, AND DEFAULTS
    
    // Android
    public static ANDROID_PLATFORM_OPTION_NAME: string;
    
    public static ANDROID_SERVER_URL: string;
    public static defaultAndroidServerUrl: string;
    
    public static ANDROID_EMULATOR: string;
    public static defaultAndroidEmulator: string;
    
    // iOS
    public static IOS_PLATFORM_OPTION_NAME: string;
    
    public static IOS_SERVER_URL: string;
    public static defaultIOSServerUrl: string;
    
    public static IOS_EMULATOR: string;
    public static SHOULD_USE_WKWEBVIEW: string;
    
    // Both
    public static templatePath: string;
    public static thisPluginPath: string;
    
    public static TEST_RUN_DIRECTORY: string;
    
    public static TEST_UPDATES_DIRECTORY: string;
    
    public static CORE_TESTS_ONLY: string;
    public static PULL_FROM_NPM: string;
    
    public static SETUP: string;
    public static RESTART_EMULATORS: string;
    
    /**
     * Reads the directory in which the test project is.
     */
    public static readTestRunDirectory(): string;
    
    /**
     * Reads the directory in which the test project for updates is.
     */
    public static readTestUpdatesDirectory(): string;
    
    /**
     * Reads the path of the plugin (whether or not we should use the local copy or pull from npm)
     */
    public static readPluginPath(): string;
    
    /**
     * Reads the Android server url to use
     */
    public static readAndroidServerUrl(): string;
    
    /**
     * Reads the iOS server url to use
     */
    public static readIOSServerUrl(): string;
    
    /**
     * Reads the Android emulator to use
     */
    public static readAndroidEmulator(): string;
    
    /**
     * Reads the iOS emulator to use
     */
    public static readIOSEmulator(): Q.Promise<string>;
    
    /**
     * Reads whether or not emulators should be restarted.
     */
    public static readRestartEmulators(): boolean;
    
    /**
     * Reads whether or not only core tests should be run.
     */
    public static readCoreTestsOnly(): boolean;
    
    /**
     * Reads whether or not to setup the test project directories.
     */
    public static readShouldSetup(): boolean;
    
    /**
     * Reads the test target platforms.
     */
    public static readTargetPlatforms(): string[];
    
    /**
     * Reads if we should use the WkWebView or the UIWebView or run tests for both.
     * 0 for UIWebView, 1 for WkWebView, 2 for both
     */
    public static readShouldUseWkWebView(): number;
    
    /**
     * Executes a child process returns its output as a string.
     */
    public static getProcessOutput(command: string, options?: NodeJSChildProcess.IExecOptions, logOutput?: boolean): Q.Promise<string>;
}
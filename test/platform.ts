/// <reference types="node" />

"use strict";

import path = require("path");
import ProjectManager = require("./projectManager");
import tu = require("./testUtil");
import Q = require("q");

/**
 * Defines a platform supported by CodePush.
 */
export interface IPlatform {
    /**
     * Gets the Cordova specific platform name. (e.g. "android" for the Android platform).
     */
    getCordovaName(): string;

    /**
     * Gets the server url used for testing.
     */
    getServerUrl(): string;

    /**
     * Gets the root of the platform www folder used for creating update packages.
     */
    getPlatformWwwPath(projectDirectory: string): string;

    /**
     * Gets an optional IEmulatorManager for platforms for which "cordova run --nobuild" rebuilds the application for this platform anyway.
     * IOS needs special handling here, since ios-sim touches the app every time and changes the app timestamp.
     * This challenges the tests since we rely on the app timestamp in our logic for finding out if the application was updated through the app store.
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
export interface IEmulatorManager {
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
export class Android implements IPlatform {
    private static instance: Android;
    private emulatorManager: IEmulatorManager;
    private serverUrl: string;

    constructor(emulatorManager: IEmulatorManager) {
        this.emulatorManager = emulatorManager;
    }

    public static getInstance(): Android {
        if (!this.instance) {
            this.instance = new Android(new AndroidEmulatorManager());
        }

        return this.instance;
    }

    public getCordovaName(): string {
        return "android";
    }

    /**
     * Gets the server url used for testing.
     */
    public getServerUrl(): string {
        if (!this.serverUrl) this.serverUrl = tu.TestUtil.readAndroidServerUrl();
        return this.serverUrl;
    }

    public getPlatformWwwPath(projectDirectory: string): string {
        return path.join(projectDirectory, "platforms/android/app/src/main/assets/www");
    }

    public getEmulatorManager(): IEmulatorManager {
        return this.emulatorManager;
    }

    public getDefaultDeploymentKey(): string {
        return "mock-android-deployment-key";
    }
}

/**
 * IOS implementation of IPlatform.
 */
export class IOS implements IPlatform {
    private static instance: IOS;
    private emulatorManager: IEmulatorManager;
    private serverUrl: string;

    constructor(emulatorManager: IEmulatorManager) {
        this.emulatorManager = emulatorManager;
    }

    public static getInstance(): IOS {
        if (!this.instance) {
            this.instance = new IOS(new IOSEmulatorManager());
        }

        return this.instance;
    }

    public getCordovaName(): string {
        return "ios";
    }

    /**
     * Gets the server url used for testing.
     */
    public getServerUrl(): string {
        if (!this.serverUrl) this.serverUrl = tu.TestUtil.readIOSServerUrl();
        return this.serverUrl;
    }

    public getPlatformWwwPath(projectDirectory: string): string {
        return path.join(projectDirectory, "platforms/ios/www");
    }

    public getEmulatorManager(): IEmulatorManager {
        return this.emulatorManager;
    }

    public getDefaultDeploymentKey(): string {
        return "mock-ios-deployment-key";
    }
}

// bootEmulatorInternal constants
const emulatorMaxReadyAttempts = 5;
const emulatorReadyCheckDelayMs = 30 * 1000;
// Called to boot an emulator with a given platformName and check, start, and kill methods.
function bootEmulatorInternal(platformName: string, restartEmulators: boolean, targetEmulator: string,
    checkEmulator: () => Q.Promise<string>, startEmulator: (targetEmulator: string) => Q.Promise<string>, killEmulator: () => Q.Promise<string>): Q.Promise<string> {
    var deferred = Q.defer<string>();
    console.log("Setting up " + platformName + " emulator.");

    function onEmulatorReady(): Q.Promise<string> {
        console.log(platformName + " emulator is ready!");
        deferred.resolve(undefined);
        return deferred.promise;
    }

    // Called to check if the emulator for the platform is initialized.
    function checkEmulatorReady(): Q.Promise<string> {
        var checkDeferred = Q.defer<string>();

        console.log("Checking if " + platformName + " emulator is ready yet...");
        // Dummy command that succeeds if emulator is ready and fails otherwise.
        checkEmulator()
            .then(() => {
                checkDeferred.resolve(undefined);
            }, (error) => {
                console.log(platformName + " emulator is not ready yet!");
                checkDeferred.reject(error);
            });

        return checkDeferred.promise;
    }

    var emulatorReadyAttempts = 0;
    // Loops checks to see if the emulator is ready and eventually fails after surpassing emulatorMaxReadyAttempts.
    function checkEmulatorReadyLooper(): Q.Promise<string> {
        var looperDeferred = Q.defer<string>();
        emulatorReadyAttempts++;
        if (emulatorReadyAttempts > emulatorMaxReadyAttempts) {
            console.log(platformName + " emulator is not ready after " + emulatorMaxReadyAttempts + " attempts, abort.");
            deferred.reject(platformName + " emulator failed to boot.");
            looperDeferred.resolve(undefined);
        }
        setTimeout(() => {
            checkEmulatorReady()
                .then(() => {
                    looperDeferred.resolve(undefined);
                    onEmulatorReady();
                }, () => {
                    return checkEmulatorReadyLooper().then(() => { looperDeferred.resolve(undefined); }, () => { looperDeferred.reject(undefined); });
                });
        }, emulatorReadyCheckDelayMs);
        return looperDeferred.promise;
    }

    // Starts and loops the emulator.
    function startEmulatorAndLoop(): Q.Promise<string> {
        console.log("Booting " + platformName + " emulator named " + targetEmulator + ".");
        startEmulator(targetEmulator).catch((error) => { console.log(error); deferred.reject(error); });
        return checkEmulatorReadyLooper();
    }
    var promise: Q.Promise<string>;
    if (restartEmulators) {
        console.log("Killing " + platformName + " emulator.");
        promise = killEmulator().catch(() => { return null; }).then(startEmulatorAndLoop);
    } else {
        promise = checkEmulatorReady().then(onEmulatorReady, startEmulatorAndLoop);
    }

    return deferred.promise;
}

export class IOSEmulatorManager implements IEmulatorManager {
    /**
     * Boots the target emulator.
     */
    bootEmulator(restartEmulators: boolean): Q.Promise<string> {
        function checkIOSEmulator(): Q.Promise<string> {
            // A command that does nothing but only succeeds if the emulator is running.
            // Get the environment variable with the name "asdf" (return null, not an error, if not initialized).
            return tu.TestUtil.getProcessOutput("xcrun simctl getenv booted asdf");
        }
        function startIOSEmulator(iOSEmulatorName: string): Q.Promise<string> {
            return tu.TestUtil.getProcessOutput("xcrun instruments -w \"" + iOSEmulatorName + "\"")
                .catch((error) => { return undefined; /* Always fails because we do not specify a template, which is not necessary to just start the emulator */ });
        }
        function killIOSEmulator(): Q.Promise<string> {
            return tu.TestUtil.getProcessOutput("killall Simulator");
        }

        return tu.TestUtil.readIOSEmulator()
            .then((iOSEmulatorName: string) => {
                return bootEmulatorInternal("iOS", restartEmulators, iOSEmulatorName, checkIOSEmulator, startIOSEmulator, killIOSEmulator);
            });
    }

    /**
     * Launches an already installed application by app id.
     */
    launchInstalledApplication(appId: string): Q.Promise<string> {
        return tu.TestUtil.getProcessOutput("xcrun simctl launch booted " + appId, undefined);
    }

    /**
     * Ends a running application given its app id.
     */
    endRunningApplication(appId: string): Q.Promise<string> {
        return tu.TestUtil.getProcessOutput("xcrun simctl spawn booted launchctl list", undefined)
            .then<string>(processListOutput => {
                // find the app's process
                var regex = new RegExp("(\\S+" + appId + "\\S+)");
                var execResult: any[] = regex.exec(processListOutput);
                if (execResult) {
                    return execResult[0];
                }
                else {
                    return Q.reject("Could not get the running application label.");
                }
            })
            .then<string>(applicationLabel => {
                // kill the app if we found the process
                return tu.TestUtil.getProcessOutput("xcrun simctl spawn booted launchctl stop " + applicationLabel, undefined);
            }, (error) => {
                // we couldn't find the app's process so it must not be running
                return Q.resolve(error);
            });
    }

    /**
     * Restarts an already installed application by app id.
     */
    restartApplication(appId: string): Q.Promise<string> {
        return this.endRunningApplication(appId)
            .then<void>(() => {
                // wait for a second before restarting
                return Q.delay(1000);
            })
            .then(() => this.launchInstalledApplication(appId));
    }

    /**
     * Navigates away from the current app, waits for a delay (defaults to 1 second), then navigates to the specified app.
     */
    resumeApplication(appId: string, delayBeforeResumingMs: number = 1000): Q.Promise<string> {
        // open a default iOS app (for example, camera)
        return this.launchInstalledApplication("com.apple.Preferences")
            .then<void>(() => {
                console.log("Waiting for " + delayBeforeResumingMs + "ms before resuming the test application.");
                return Q.delay(delayBeforeResumingMs);
            })
            .then<string>(() => {
                // reopen the app
                return this.launchInstalledApplication(appId);
            });
    }

    /**
     * Prepares the emulator for a test.
     */
    prepareEmulatorForTest(appId: string): Q.Promise<string> {
        return this.endRunningApplication(appId);
    }

    /**
     * Uninstalls the app from the emulator.
     */
    uninstallApplication(appId: string): Q.Promise<string> {
        return tu.TestUtil.getProcessOutput("xcrun simctl uninstall booted " + appId, undefined);
    }
}

export class AndroidEmulatorManager implements IEmulatorManager {
    /**
     * Boots the target emulator.
     */
    bootEmulator(restartEmulators: boolean): Q.Promise<string> {
        function checkAndroidEmulator(): Q.Promise<string> {
            // A command that does nothing but only succeeds if the emulator is running.
            // List all of the packages on the device.
            return tu.TestUtil.getProcessOutput("adb shell pm list packages");
        }

        function startAndroidEmulator(androidEmulatorName: string): Q.Promise<string> {
            const androidEmulatorCommand = `emulator @${androidEmulatorName}`;
            let osSpecificCommand = "";
            if (process.platform === "darwin") {
                osSpecificCommand = `${androidEmulatorCommand} &`;
            } else {
                osSpecificCommand = `START /B ${androidEmulatorCommand}`;
            }
            return tu.TestUtil.getProcessOutput(osSpecificCommand, { timeout: 5000 }, false);
        }

        function killAndroidEmulator(): Q.Promise<string> {
            return tu.TestUtil.getProcessOutput("adb emu kill");
        }

        return tu.TestUtil.readAndroidEmulator()
            .then((AndroidEmulatorName: string) => {
                return bootEmulatorInternal("Android", restartEmulators, AndroidEmulatorName, checkAndroidEmulator, startAndroidEmulator, killAndroidEmulator);
            });
    }

    /**
     * Launches an already installed application by app id.
     */
    launchInstalledApplication(appId: string): Q.Promise<string> {
        return ProjectManager.ProjectManager.execChildProcess("adb shell monkey -p " + appId + " -c android.intent.category.LAUNCHER 1");
    }

    /**
     * Ends a running application given its app id.
     */
    endRunningApplication(appId: string): Q.Promise<string> {
        return ProjectManager.ProjectManager.execChildProcess("adb shell am force-stop " + appId);
    }

    /**
     * Restarts an already installed application by app id.
     */
    restartApplication(appId: string): Q.Promise<string> {
        return this.endRunningApplication(appId)
            .then<void>(() => {
                // wait for a second before restarting
                return Q.delay(1000);
            })
            .then<string>(() => {
                return this.launchInstalledApplication(appId);
            });
    }

    /**
     * Navigates away from the current app, waits for a delay (defaults to 1 second), then navigates to the specified app.
     */
    resumeApplication(appId: string, delayBeforeResumingMs: number = 1000): Q.Promise<string> {
        // open a default Android app (for example, settings)
        return this.launchInstalledApplication("com.android.settings")
            .then<void>(() => {
                console.log("Waiting for " + delayBeforeResumingMs + "ms before resuming the test application.");
                return Q.delay(delayBeforeResumingMs);
            })
            .then<string>(() => {
                // reopen the app
                return this.launchInstalledApplication(appId);
            });
    }

    /**
     * Prepares the emulator for a test.
     */
    prepareEmulatorForTest(appId: string): Q.Promise<string> {
        return this.endRunningApplication(appId)
            .then(() => { return commandWithCheckAppExistence("adb shell pm clear", appId); });
    }

    /**
     * Uninstalls the app from the emulator.
     */
    uninstallApplication(appId: string): Q.Promise<string> {
        return commandWithCheckAppExistence("adb uninstall", appId);
    }
}

/**
 * Supported platforms resolver.
 */
export class PlatformResolver {

    private static supportedPlatforms: IPlatform[] = [Android.getInstance(), IOS.getInstance()];

    /**
     * Given the cordova name of a platform, this method returns the IPlatform associated with it.
     */
    public static resolvePlatforms(cordovaPlatformNames: string[]): IPlatform[] {
        var platforms: IPlatform[] = [];

        for (var i = 0; i < cordovaPlatformNames.length; i++) {
            var resolvedPlatform: IPlatform = PlatformResolver.resolvePlatform(cordovaPlatformNames[i]);
            if (resolvedPlatform) platforms.push(resolvedPlatform);
            else {
                // we could not find this platform in the list of platforms, so abort
                console.error("Unsupported platform: " + cordovaPlatformNames[i]);
                return undefined;
            }
        }

        return platforms;
    }

    /**
     * Given the cordova name of a platform, this method returns the IPlatform associated with it.
     */
    public static resolvePlatform(cordovaPlatformName: string): IPlatform {
        for (var i = 0; i < this.supportedPlatforms.length; i++) {
            if (this.supportedPlatforms[i].getCordovaName() === cordovaPlatformName) {
                return this.supportedPlatforms[i];
            }
        }

        // we could not find this platform in the list of platforms, so abort
        console.error("Unsupported platform: " + cordovaPlatformName);
        return undefined;
    }
}

function commandWithCheckAppExistence(command: string, appId: string) {
    return ProjectManager.ProjectManager.execChildProcess("adb shell pm list packages")
        .then((output) => {
            return output.includes(appId);
        }).then((isAppExist) => {
            if (isAppExist) {
                return ProjectManager.ProjectManager.execChildProcess(`${command} ${appId}`).then(function () { return null; });
            }
            console.log(`Command "${command}" is skipped because the application has not yet been installed`);
            return null;
        });
}

/// <reference path="../typings/node.d.ts" />

"use strict";

import path = require("path");
import ProjectManager = require("./ProjectManager");
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
        return tu.TestUtil.AndroidServerUrl;
    }

    public getPlatformWwwPath(projectDirectory: string): string {
        return path.join(projectDirectory, "platforms/android/assets/www");
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
        return tu.TestUtil.IOSServerUrl;
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

export class IOSEmulatorManager implements IEmulatorManager {
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
        return this.launchInstalledApplication("com.apple.camera")
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
     * Launches an already installed application by app id.
     */
    launchInstalledApplication(appId: string): Q.Promise<string> {
        return ProjectManager.ProjectManager.execAndLogChildProcess("adb shell monkey -p " + appId + " -c android.intent.category.LAUNCHER 1");
    }
    
    /**
     * Ends a running application given its app id.
     */
    endRunningApplication(appId: string): Q.Promise<string> {
        return ProjectManager.ProjectManager.execAndLogChildProcess("adb shell am force-stop " + appId);
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
            .then(() => { return ProjectManager.ProjectManager.execAndLogChildProcess("adb shell pm clear " + appId); });
    }
    
    /**
     * Uninstalls the app from the emulator.
     */
    uninstallApplication(appId: string): Q.Promise<string> {
        return ProjectManager.ProjectManager.execAndLogChildProcess("adb uninstall " + appId);
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
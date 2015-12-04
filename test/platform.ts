/// <reference path="../typings/node.d.ts" />

"use strict";

import path = require("path");
import tu = require("./testUtil");

/**
 * Defines a platform supported by CodePush.
 */
export interface IPlatform {
    /**
     * Gets the Cordova specific platform name. (e.g. "android" for the Android platform).
     */
    getCordovaName(): string;
    
    /**
     * Gets the root of the platform www folder used for creating update packages.
     */
    getPlatformWwwPath(projectDirectory: string): string;
    
    /**
     * Gets an optional IEmulatorManager for platforms for which "cordova run --nobuild" rebuilds the application for this platform anyway.
     * IOS needs special handling here, since ios-sim touches the app every time and changes the app timestamp.
     * This challenges the tests since we rely on the app timestamp in our logic for finding out if the application was updated through the app store.
     */
    getOptionalEmulatorManager(): IEmulatorManager;
    
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
     * Ends a running application, given its Cordova app id.
     */
    endRunningApplication(appId: string): Q.Promise<void>;
    
    /**
     * Launches an already installed application by app id.
     */
    launchInstalledApplication(appId: string): Q.Promise<void>;
}

/**
 * Android implementations of IPlatform.
 */
export class Android implements IPlatform {
    private static instance: Android;

    public static getInstance(): Android {
        if (!this.instance) {
            this.instance = new Android();
        }

        return this.instance;
    }

    public getCordovaName(): string {
        return "android";
    }

    public getPlatformWwwPath(projectDirectory: string): string {
        return path.join(projectDirectory, "platforms/android/assets/www");
    }

    public getOptionalEmulatorManager(): IEmulatorManager {
        /* Android does not need a separate emulator manager.
        All interaction with the emulator is done using the Cordova CLI. */
        return null;
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

    public getPlatformWwwPath(projectDirectory: string): string {
        return path.join(projectDirectory, "platforms/ios/www");
    }

    public getOptionalEmulatorManager(): IEmulatorManager {
        return this.emulatorManager;
    }

    public getDefaultDeploymentKey(): string {
        return "mock-ios-deployment-key";
    }
}

export class IOSEmulatorManager implements IEmulatorManager {
    /**
     * Ends a running application, given its Cordova app id.
     */
    public endRunningApplication(appId: string): Q.Promise<void> {
        return tu.TestUtil.getProcessOutput("xcrun simctl spawn booted launchctl list", undefined, true)
            .then<string>(processListOutput => {
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
                return tu.TestUtil.getProcessOutput("xcrun simctl spawn booted launchctl stop " + applicationLabel, undefined, true);
            })
            .then<void>(output => {
                console.log(output);
            });
    }
    
    /**
     * Launches an already installed application by app id.
     */
    public launchInstalledApplication(appId: string): Q.Promise<void> {
        return tu.TestUtil.getProcessOutput("xcrun simctl launch booted " + appId, undefined, true)
            .then<void>(output => { console.log(output); });
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
    public static resolvePlatform(cordovaPlatformName: string): IPlatform {

        for (var i = 0; i < this.supportedPlatforms.length; i++) {
            if (this.supportedPlatforms[i].getCordovaName() === cordovaPlatformName) {
                return this.supportedPlatforms[i];
            }
        }

        console.error("Unsupported platform: " + cordovaPlatformName);
        return undefined;
    }
}
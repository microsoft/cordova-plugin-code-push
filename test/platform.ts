/// <reference path="../typings/node.d.ts" />

"use strict";

import path = require("path");

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
}

/**
 * IOS implementation of IPlatform.
 */
export class IOS implements IPlatform {
    private static instance: IOS;

    public static getInstance(): IOS {
        if (!this.instance) {
            this.instance = new IOS();
        }

        return this.instance;
    }

    public getCordovaName(): string {
        return "ios";
    }

    public getPlatformWwwPath(projectDirectory: string): string {
        return path.join(projectDirectory, "platforms/ios/www");
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
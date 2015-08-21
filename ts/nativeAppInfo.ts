/**
 *******************************************************
 *                                                     *
 *   Copyright (C) Microsoft. All rights reserved.     *
 *                                                     *
 *******************************************************
 */

/// <reference path="./typings/cordova.d.ts" />

"use strict";

/**
 * Provides information about the native app.
 */
class NativeAppInfo {
    /**
     * Gets the application build timestamp.
     */
    public static getApplicationBuildTime(callback: Callback<String>): void {
        var timestampSuccess = (timestamp?: String) => { callback(null, timestamp); };
        var timestampError = () => { callback(new Error("Could not get application timestamp."), null); };

        cordova.exec(timestampSuccess, timestampError, "CodePush", "getNativeBuildTime", []);
    }

    /**
     * Gets the application version.
     */
    public static getApplicationVersion(callback: Callback<String>): void {
        var versionSuccess = (version?: String) => { callback(null, version); };
        var versionError = () => { callback(new Error("Could not get application version."), null); };

        cordova.exec(versionSuccess, versionError, "CodePush", "getAppVersion", []);
    }
    
    /**
     * Gets the server URL from config.xml by calling into the native platform.
     */
    public static getServerURL(serverCallback: Callback<String>): void {
        var serverSuccess = (serverURL?: String) => { serverCallback(null, serverURL); };
        var serverError = () => { serverCallback(new Error("Server URL not found."), null); };

        cordova.exec(serverSuccess, serverError, "CodePush", "getServerURL", []);
    }

    /**
     * Gets the deployment key from config.xml by calling into the native platform.
     */
    public static getDeploymentKey(deploymentKeyCallback: Callback<String>): void {
        var deploymentSuccess = (deploymentKey?: String) => { deploymentKeyCallback(null, deploymentKey); };
        var deploymentError = () => { deploymentKeyCallback(new Error("Deployment key not found."), null); };

        cordova.exec(deploymentSuccess, deploymentError, "CodePush", "getDeploymentKey", []);
    }
}

export = NativeAppInfo;
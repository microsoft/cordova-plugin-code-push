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
var NativeAppInfo = (function () {
    function NativeAppInfo() {
    }
    /**
     * Gets the application build timestamp.
     */
    NativeAppInfo.getApplicationBuildTime = function (callback) {
        var timestampSuccess = function (timestamp) { callback(null, timestamp); };
        var timestampError = function () { callback(new Error("Could not get application timestamp."), null); };
        cordova.exec(timestampSuccess, timestampError, "CodePush", "getNativeBuildTime", []);
    };
    /**
     * Gets the application version.
     */
    NativeAppInfo.getApplicationVersion = function (callback) {
        var versionSuccess = function (version) { callback(null, version); };
        var versionError = function () { callback(new Error("Could not get application version."), null); };
        cordova.exec(versionSuccess, versionError, "CodePush", "getAppVersion", []);
    };
    /**
     * Gets the server URL from config.xml by calling into the native platform.
     */
    NativeAppInfo.getServerURL = function (serverCallback) {
        var serverSuccess = function (serverURL) { serverCallback(null, serverURL); };
        var serverError = function () { serverCallback(new Error("Server URL not found."), null); };
        cordova.exec(serverSuccess, serverError, "CodePush", "getServerURL", []);
    };
    /**
     * Gets the deployment key from config.xml by calling into the native platform.
     */
    NativeAppInfo.getDeploymentKey = function (deploymentKeyCallback) {
        var deploymentSuccess = function (deploymentKey) { deploymentKeyCallback(null, deploymentKey); };
        var deploymentError = function () { deploymentKeyCallback(new Error("Deployment key not found."), null); };
        cordova.exec(deploymentSuccess, deploymentError, "CodePush", "getDeploymentKey", []);
    };
    return NativeAppInfo;
})();
module.exports = NativeAppInfo;


 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE DIRECTLY AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER, AND THEN RUN GULP. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.md. 
 *********************************************************************************************/ 


"use strict";
var DefaultServerUrl = "https://codepush.appcenter.ms/";
var NativeAppInfo = (function () {
    function NativeAppInfo() {
    }
    NativeAppInfo.getApplicationBuildTime = function (callback) {
        var timestampSuccess = function (timestamp) { callback(null, timestamp); };
        var timestampError = function () { callback(new Error("Could not get application timestamp."), null); };
        cordova.exec(timestampSuccess, timestampError, "CodePush", "getNativeBuildTime", []);
    };
    NativeAppInfo.getApplicationVersion = function (callback) {
        var versionSuccess = function (version) { callback(null, version); };
        var versionError = function () { callback(new Error("Could not get application version."), null); };
        cordova.exec(versionSuccess, versionError, "CodePush", "getAppVersion", []);
    };
    NativeAppInfo.getBinaryHash = function (callback) {
        var binaryHashSuccess = function (binaryHash) { callback(null, binaryHash); };
        var binaryHashError = function () { callback(new Error("Could not get binary hash."), null); };
        cordova.exec(binaryHashSuccess, binaryHashError, "CodePush", "getBinaryHash", []);
    };
    NativeAppInfo.getServerURL = function (serverCallback) {
        var serverSuccess = function (serverURL) { serverCallback(null, serverURL); };
        var serverError = function () { serverCallback(null, DefaultServerUrl); };
        cordova.exec(serverSuccess, serverError, "CodePush", "getServerURL", []);
    };
    NativeAppInfo.getDeploymentKey = function (deploymentKeyCallback) {
        var deploymentSuccess = function (deploymentKey) { deploymentKeyCallback(null, deploymentKey); };
        var deploymentError = function () { deploymentKeyCallback(new Error("Deployment key not found."), null); };
        cordova.exec(deploymentSuccess, deploymentError, "CodePush", "getDeploymentKey", []);
    };
    NativeAppInfo.isFailedUpdate = function (packageHash, checkCallback) {
        var win = function (failed) {
            checkCallback && checkCallback(!!failed);
        };
        var fail = function (e) {
            win(0);
        };
        cordova.exec(win, fail, "CodePush", "isFailedUpdate", [packageHash]);
    };
    NativeAppInfo.isFirstRun = function (packageHash, firstRunCallback) {
        var win = function (firstRun) {
            firstRunCallback(!!firstRun);
        };
        var fail = function () {
            firstRunCallback(false);
        };
        cordova.exec(win, fail, "CodePush", "isFirstRun", [packageHash]);
    };
    NativeAppInfo.isPendingUpdate = function (callback) {
        var win = function (firstRun) {
            callback(!!firstRun);
        };
        var fail = function () {
            callback(false);
        };
        cordova.exec(win, fail, "CodePush", "isPendingUpdate", []);
    };
    return NativeAppInfo;
}());
module.exports = NativeAppInfo;

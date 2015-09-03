
 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 ALSO, PLEASE DO NOT SUBMIT PULL REQUESTS WITH CHANGES TO THIS FILE. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.MD. 
 *********************************************************************************************/ 


/// <reference path="../typings/codePush.d.ts" />
/// <reference path="../typings/fileSystem.d.ts" />
/// <reference path="../typings/fileTransfer.d.ts" />
/// <reference path="../typings/cordova.d.ts" />
"use strict";
var LocalPackage = require("./localPackage");
var RemotePackage = require("./remotePackage");
var HttpRequester = require("./httpRequester");
var CallbackUtil = require("./callbackUtil");
var NativeAppInfo = require("./nativeAppInfo");
var CodePush = (function () {
    function CodePush() {
    }
    CodePush.prototype.notifyApplicationReady = function (notifySucceeded, notifyFailed) {
        cordova.exec(notifySucceeded, notifyFailed, "CodePush", "updateSuccess", []);
    };
    CodePush.prototype.getCurrentPackage = function (packageSuccess, packageError) {
        return LocalPackage.getPackageInfoOrNull(LocalPackage.PackageInfoFile, packageSuccess, packageError);
    };
    CodePush.prototype.checkForUpdate = function (querySuccess, queryError) {
        try {
            var callback = function (error, remotePackage) {
                if (error) {
                    queryError && queryError(error);
                }
                else {
                    if (remotePackage) {
                        NativeAppInfo.isFailedUpdate(remotePackage.packageHash, function (applyFailed) {
                            var result = new RemotePackage();
                            result.appVersion = remotePackage.appVersion;
                            result.deploymentKey = remotePackage.deploymentKey;
                            result.description = remotePackage.description;
                            result.downloadUrl = remotePackage.downloadUrl;
                            result.isMandatory = remotePackage.isMandatory;
                            result.label = remotePackage.label;
                            result.packageHash = remotePackage.packageHash;
                            result.packageSize = remotePackage.packageSize;
                            result.failedApply = applyFailed;
                            querySuccess(result);
                        });
                    }
                    else {
                        querySuccess(null);
                    }
                }
            };
            this.createAcquisitionManager(function (initError, acquisitionManager) {
                if (initError) {
                    queryError && queryError(initError);
                }
                else {
                    LocalPackage.getCurrentOrDefaultPackage(function (localPackage) {
                        acquisitionManager.queryUpdateWithCurrentPackage(localPackage, callback);
                    }, function (error) {
                        queryError && queryError(error);
                    });
                }
            });
        }
        catch (e) {
            queryError && queryError(new Error("An error ocurred while querying for updates." + CallbackUtil.getErrorMessage(e)));
        }
    };
    CodePush.prototype.createAcquisitionManager = function (callback) {
        NativeAppInfo.getServerURL(function (serverError, serverURL) {
            NativeAppInfo.getDeploymentKey(function (depolymentKeyError, deploymentKey) {
                if (!serverURL || !deploymentKey) {
                    callback(new Error("Could not get the Code Push configuration. Please check your config.xml file."), null);
                }
                else {
                    var configuration = { deploymentKey: deploymentKey, serverUrl: serverURL, ignoreAppVersion: false };
                    var acquisitionManager = new AcquisitionManager(new HttpRequester(), configuration);
                    callback(null, acquisitionManager);
                }
            });
        });
    };
    return CodePush;
})();
var instance = new CodePush();
module.exports = instance;

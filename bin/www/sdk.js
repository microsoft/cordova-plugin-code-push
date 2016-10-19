
 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE DIRECTLY AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER, AND THEN RUN GULP. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.md. 
 *********************************************************************************************/ 


"use strict";
var NativeAppInfo = require("./nativeAppInfo");
var HttpRequester = require("./httpRequester");
var Sdk = (function () {
    function Sdk() {
    }
    Sdk.getAcquisitionManager = function (callback, userDeploymentKey, contentType) {
        var resolveManager = function () {
            if (userDeploymentKey !== Sdk.DefaultConfiguration.deploymentKey || contentType) {
                var customConfiguration = {
                    deploymentKey: userDeploymentKey || Sdk.DefaultConfiguration.deploymentKey,
                    serverUrl: Sdk.DefaultConfiguration.serverUrl,
                    ignoreAppVersion: Sdk.DefaultConfiguration.ignoreAppVersion,
                    appVersion: Sdk.DefaultConfiguration.appVersion,
                    clientUniqueId: Sdk.DefaultConfiguration.clientUniqueId
                };
                var requester = new HttpRequester(contentType);
                var customAcquisitionManager = new AcquisitionManager(requester, customConfiguration);
                callback(null, customAcquisitionManager);
            }
            else if (Sdk.DefaultConfiguration.deploymentKey) {
                callback(null, Sdk.DefaultAcquisitionManager);
            }
            else {
                callback(new Error("No deployment key provided, please provide a default one in your config.xml or specify one in the call to checkForUpdate() or sync()."), null);
            }
        };
        if (Sdk.DefaultAcquisitionManager) {
            resolveManager();
        }
        else {
            NativeAppInfo.getServerURL(function (serverError, serverURL) {
                NativeAppInfo.getDeploymentKey(function (depolymentKeyError, deploymentKey) {
                    NativeAppInfo.getApplicationVersion(function (appVersionError, appVersion) {
                        if (!appVersion) {
                            callback(new Error("Could not get the app version. Please check your config.xml file."), null);
                        }
                        else if (!serverURL) {
                            callback(new Error("Could not get the CodePush configuration. Please check your config.xml file."), null);
                        }
                        else {
                            Sdk.DefaultConfiguration = {
                                deploymentKey: deploymentKey,
                                serverUrl: serverURL,
                                ignoreAppVersion: false,
                                appVersion: appVersion,
                                clientUniqueId: device.uuid
                            };
                            if (deploymentKey) {
                                Sdk.DefaultAcquisitionManager = new AcquisitionManager(new HttpRequester(), Sdk.DefaultConfiguration);
                            }
                            resolveManager();
                        }
                    });
                });
            });
        }
    };
    Sdk.reportStatusDeploy = function (pkg, status, currentDeploymentKey, previousLabelOrAppVersion, previousDeploymentKey, callback) {
        try {
            Sdk.getAcquisitionManager(function (error, acquisitionManager) {
                if (error) {
                    callback && callback(error, null);
                }
                else {
                    acquisitionManager.reportStatusDeploy(pkg, status, previousLabelOrAppVersion, previousDeploymentKey, callback);
                }
            }, currentDeploymentKey, "application/json");
        }
        catch (e) {
            callback && callback(e, null);
        }
    };
    Sdk.reportStatusDownload = function (pkg, deploymentKey, callback) {
        try {
            Sdk.getAcquisitionManager(function (error, acquisitionManager) {
                if (error) {
                    callback && callback(error, null);
                }
                else {
                    acquisitionManager.reportStatusDownload(pkg, callback);
                }
            }, deploymentKey, "application/json");
        }
        catch (e) {
            callback && callback(new Error("An error occured while reporting the download status. " + e), null);
        }
    };
    return Sdk;
}());
module.exports = Sdk;

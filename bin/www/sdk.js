
 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 ALSO, PLEASE DO NOT SUBMIT PULL REQUESTS WITH CHANGES TO THIS FILE. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.md. 
 *********************************************************************************************/ 


"use strict";
var NativeAppInfo = require("./nativeAppInfo");
var HttpRequester = require("./httpRequester");
var Sdk = (function () {
    function Sdk() {
    }
    Sdk.getAcquisitionManager = function (callback, userDeploymentKey, contentType) {
        var resolveManager = function (defaultInstance) {
            if (userDeploymentKey || contentType) {
                var customConfiguration = {
                    deploymentKey: (userDeploymentKey ? userDeploymentKey : Sdk.DefaultConfiguration.deploymentKey),
                    serverUrl: Sdk.DefaultConfiguration.serverUrl,
                    ignoreAppVersion: Sdk.DefaultConfiguration.ignoreAppVersion,
                    appVersion: Sdk.DefaultConfiguration.appVersion,
                    clientUniqueId: Sdk.DefaultConfiguration.clientUniqueId
                };
                var requester = new HttpRequester(contentType);
                var customAcquisitionManager = new AcquisitionManager(requester, customConfiguration);
                callback(null, customAcquisitionManager);
            }
            else {
                callback(null, Sdk.DefaultAcquisitionManager);
            }
        };
        if (Sdk.DefaultAcquisitionManager) {
            resolveManager(Sdk.DefaultAcquisitionManager);
        }
        else {
            NativeAppInfo.getServerURL(function (serverError, serverURL) {
                NativeAppInfo.getDeploymentKey(function (depolymentKeyError, deploymentKey) {
                    NativeAppInfo.getApplicationVersion(function (appVersionError, appVersion) {
                        if (!serverURL || !deploymentKey || !appVersion) {
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
                            Sdk.DefaultAcquisitionManager = new AcquisitionManager(new HttpRequester(), Sdk.DefaultConfiguration);
                            resolveManager(Sdk.DefaultAcquisitionManager);
                        }
                    });
                });
            });
        }
    };
    Sdk.reportStatusDeploy = function (pkg, status, deploymentKey, callback) {
        try {
            Sdk.getAcquisitionManager(function (error, acquisitionManager) {
                if (error) {
                    callback && callback(error, null);
                }
                else {
                    acquisitionManager.reportStatusDeploy(pkg, status, callback);
                }
            }, deploymentKey, "application/json");
        }
        catch (e) {
            callback && callback(new Error("An error occured while reporting the deployment status. " + e), null);
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
})();
module.exports = Sdk;


 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 ALSO, PLEASE DO NOT SUBMIT PULL REQUESTS WITH CHANGES TO THIS FILE. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.md. 
 *********************************************************************************************/ 


/// <reference path="../typings/codePush.d.ts" />
/// <reference path="../typings/fileTransfer.d.ts" />
"use strict";
var NativeAppInfo = require("./nativeAppInfo");
var HttpRequester = require("./httpRequester");
var Sdk = (function () {
    function Sdk() {
    }
    Sdk.getAcquisitionManager = function (callback, userDeploymentKey) {
        var resolveManager = function (defaultInstance) {
            if (userDeploymentKey) {
                var customConfiguration = { deploymentKey: userDeploymentKey, serverUrl: Sdk.DefaultConfiguration.serverUrl, ignoreAppVersion: Sdk.DefaultConfiguration.ignoreAppVersion };
                var customAcquisitionManager = new AcquisitionManager(new HttpRequester(), customConfiguration);
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
                    if (!serverURL || !deploymentKey) {
                        callback(new Error("Could not get the CodePush configuration. Please check your config.xml file."), null);
                    }
                    else {
                        Sdk.DefaultConfiguration = { deploymentKey: deploymentKey, serverUrl: serverURL, ignoreAppVersion: false };
                        Sdk.DefaultAcquisitionManager = new AcquisitionManager(new HttpRequester(), Sdk.DefaultConfiguration);
                        resolveManager(Sdk.DefaultAcquisitionManager);
                    }
                });
            });
        }
    };
    Sdk.reportStatus = function (status, callback) {
        try {
            Sdk.getAcquisitionManager(function (error, acquisitionManager) {
                if (error) {
                    callback && callback(error, null);
                }
                else {
                    acquisitionManager.reportStatus(status, null, callback);
                }
            });
        }
        catch (e) {
            callback && callback(new Error("An error ocurred while reporting the status. " + e), null);
        }
    };
    return Sdk;
})();
module.exports = Sdk;

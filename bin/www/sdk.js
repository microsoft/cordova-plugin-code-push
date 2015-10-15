
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
    Sdk.getAcquisitionManager = function (callback) {
        if (Sdk.Instance) {
            callback(null, Sdk.Instance);
        }
        else {
            NativeAppInfo.getServerURL(function (serverError, serverURL) {
                NativeAppInfo.getDeploymentKey(function (depolymentKeyError, deploymentKey) {
                    if (!serverURL || !deploymentKey) {
                        callback(new Error("Could not get the CodePush configuration. Please check your config.xml file."), null);
                    }
                    else {
                        var configuration = { deploymentKey: deploymentKey, serverUrl: serverURL, ignoreAppVersion: false };
                        Sdk.Instance = new AcquisitionManager(new HttpRequester(), configuration);
                        callback(null, Sdk.Instance);
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

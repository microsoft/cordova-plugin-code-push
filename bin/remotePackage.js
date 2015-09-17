
 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 ALSO, PLEASE DO NOT SUBMIT PULL REQUESTS WITH CHANGES TO THIS FILE. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.MD. 
 *********************************************************************************************/ 


/// <reference path="../typings/codePush.d.ts" />
/// <reference path="../typings/fileTransfer.d.ts" />
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var LocalPackage = require("./localPackage");
var Package = require("./package");
var NativeAppInfo = require("./nativeAppInfo");
var CallbackUtil = require("./callbackUtil");
var RemotePackage = (function (_super) {
    __extends(RemotePackage, _super);
    function RemotePackage() {
        _super.apply(this, arguments);
    }
    RemotePackage.prototype.download = function (successCallback, errorCallback) {
        var _this = this;
        try {
            CallbackUtil.logMessage("Downloading update package ...");
            if (!this.downloadUrl) {
                CallbackUtil.logAndForwardError(new Error("The remote package does not contain a download URL."), errorCallback);
            }
            else {
                this.currentFileTransfer = new FileTransfer();
                var downloadSuccess = function (fileEntry) {
                    _this.currentFileTransfer = null;
                    fileEntry.file(function (file) {
                        NativeAppInfo.isFailedUpdate(_this.packageHash, function (applyFailed) {
                            var localPackage = new LocalPackage();
                            localPackage.deploymentKey = _this.deploymentKey;
                            localPackage.description = _this.description;
                            localPackage.label = _this.label;
                            localPackage.appVersion = _this.appVersion;
                            localPackage.isMandatory = _this.isMandatory;
                            localPackage.packageHash = _this.packageHash;
                            localPackage.isFirstRun = false;
                            localPackage.failedApply = applyFailed;
                            localPackage.localPath = fileEntry.toInternalURL();
                            CallbackUtil.logMessage("Package download success: " + JSON.stringify(localPackage));
                            successCallback && successCallback(localPackage);
                        });
                    }, function (fileError) {
                        CallbackUtil.logAndForwardError(new Error("Could not access local package. Error code: " + fileError.code), errorCallback);
                    });
                };
                var downloadError = function (error) {
                    _this.currentFileTransfer = null;
                    CallbackUtil.logAndForwardError(new Error(error.body), errorCallback);
                };
                this.currentFileTransfer.download(this.downloadUrl, cordova.file.dataDirectory + LocalPackage.DownloadDir + "/" + LocalPackage.PackageUpdateFileName, downloadSuccess, downloadError, true);
            }
        }
        catch (e) {
            CallbackUtil.logAndForwardError(new Error("An error ocurred while downloading the package. " + (e && e.message) ? e.message : ""), errorCallback);
        }
    };
    RemotePackage.prototype.abortDownload = function (abortSuccess, abortError) {
        try {
            if (this.currentFileTransfer) {
                this.currentFileTransfer.abort();
                abortSuccess && abortSuccess();
            }
        }
        catch (e) {
            abortError && abortError(e);
        }
    };
    return RemotePackage;
})(Package);
module.exports = RemotePackage;
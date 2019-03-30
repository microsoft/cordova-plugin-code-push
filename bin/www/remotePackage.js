
 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE DIRECTLY AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER, AND THEN RUN GULP. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.md. 
 *********************************************************************************************/ 


"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var LocalPackage = require("./localPackage");
var Package = require("./package");
var NativeAppInfo = require("./nativeAppInfo");
var CodePushUtil = require("./codePushUtil");
var Sdk = require("./sdk");
var RemotePackage = (function (_super) {
    __extends(RemotePackage, _super);
    function RemotePackage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    RemotePackage.prototype.download = function (successCallback, errorCallback, downloadProgress) {
        var _this = this;
        try {
            CodePushUtil.logMessage("Downloading update");
            if (!this.downloadUrl) {
                CodePushUtil.invokeErrorCallback(new Error("The remote package does not contain a download URL."), errorCallback);
            }
            else {
                var filedir = cordova.file.dataDirectory + LocalPackage.DownloadDir + "/";
                var filename = LocalPackage.PackageUpdateFileName;
                this.currentFileTransfer = cordova.plugin.http.downloadFile(this.downloadUrl, {}, {}, filedir + filename);
                var onFileError_1 = function (fileError, stage) {
                    var error = new Error("Could not access local package. Stage:" + stage + "Error code: " + fileError.code);
                    CodePushUtil.invokeErrorCallback(error, errorCallback);
                    CodePushUtil.logMessage(stage + ":" + fileError);
                    _this.currentFileTransfer = null;
                };
                var onFileReady_1 = function (fileEntry) {
                    _this.currentFileTransfer = null;
                    fileEntry.file(function (file) {
                        NativeAppInfo.isFailedUpdate(_this.packageHash, function (installFailed) {
                            var localPackage = new LocalPackage();
                            localPackage.deploymentKey = _this.deploymentKey;
                            localPackage.description = _this.description;
                            localPackage.label = _this.label;
                            localPackage.appVersion = _this.appVersion;
                            localPackage.isMandatory = _this.isMandatory;
                            localPackage.packageHash = _this.packageHash;
                            localPackage.isFirstRun = false;
                            localPackage.failedInstall = installFailed;
                            localPackage.localPath = fileEntry.toInternalURL();
                            CodePushUtil.logMessage("Package download success: " + JSON.stringify(localPackage));
                            successCallback && successCallback(localPackage);
                            Sdk.reportStatusDownload(localPackage, localPackage.deploymentKey);
                        });
                    }, function (fileError) { return onFileError_1(fileError, "READ_FILE"); });
                };
                this.currentFileTransfer
                    .then(function (data) { return onFileReady_1(data); }, function (reason) { return onFileError_1(reason, "HTTP_REJECTED"); })
                    .catch(function (reason) { return onFileError_1(reason, "HTTP_ERROR"); });
            }
        }
        catch (e) {
            CodePushUtil.invokeErrorCallback(new Error("An error occured while downloading the package. " + (e && e.message) ? e.message : ""), errorCallback);
        }
    };
    RemotePackage.prototype.abortDownload = function (abortSuccess, abortError) {
        try {
            if (this.currentFileTransfer) {
                this.currentFileTransfer = undefined;
                abortSuccess && abortSuccess();
            }
        }
        catch (e) {
            abortError && abortError(e);
        }
    };
    return RemotePackage;
}(Package));
module.exports = RemotePackage;

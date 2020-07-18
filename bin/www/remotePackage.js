
 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE DIRECTLY AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER, AND THEN RUN GULP. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.md. 
 *********************************************************************************************/ 


"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var LocalPackage = require("./localPackage");
var Package = require("./package");
var FileUtil = require("./fileUtil");
var NativeAppInfo = require("./nativeAppInfo");
var CodePushUtil = require("./codePushUtil");
var Sdk = require("./sdk");
var RemotePackage = (function (_super) {
    __extends(RemotePackage, _super);
    function RemotePackage() {
        var _this = _super.call(this) || this;
        _this.isDownloading = false;
        FileUtil.getDataDirectory(LocalPackage.DownloadDir, true, function (error, _) {
            if (error) {
                CodePushUtil.logError("Can't create directory for download update.", error);
            }
        });
        return _this;
    }
    RemotePackage.prototype.download = function (successCallback, errorCallback, downloadProgress) {
        var _this = this;
        try {
            CodePushUtil.logMessage("Downloading update");
            if (!this.downloadUrl) {
                CodePushUtil.invokeErrorCallback(new Error("The remote package does not contain a download URL."), errorCallback);
            }
            else {
                this.isDownloading = true;
                var onFileError_1 = function (fileError, stage) {
                    var error = new Error("Could not access local package. Stage:" + stage + "Error code: " + fileError.code);
                    CodePushUtil.invokeErrorCallback(error, errorCallback);
                    CodePushUtil.logMessage(stage + ":" + fileError);
                    _this.isDownloading = false;
                };
                var onFileReady = function (fileEntry) {
                    _this.isDownloading = false;
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
                var filedir = cordova.file.dataDirectory + LocalPackage.DownloadDir + "/";
                var filename = LocalPackage.PackageUpdateFileName;
                cordova.plugin.http.downloadFile(this.downloadUrl, {}, {}, filedir + filename, onFileReady, onFileError_1);
            }
        }
        catch (e) {
            CodePushUtil.invokeErrorCallback(new Error("An error occurred while downloading the package. " + (e && e.message) ? e.message : ""), errorCallback);
        }
    };
    RemotePackage.prototype.abortDownload = function (abortSuccess, abortError) {
        try {
            if (this.isDownloading) {
                this.isDownloading = false;
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

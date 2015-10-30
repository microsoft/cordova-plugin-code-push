
 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 ALSO, PLEASE DO NOT SUBMIT PULL REQUESTS WITH CHANGES TO THIS FILE. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.md. 
 *********************************************************************************************/ 


/// <reference path="../typings/codePush.d.ts" />
/// <reference path="../typings/fileSystem.d.ts" />
/// <reference path="../typings/fileTransfer.d.ts" />
/// <reference path="../typings/cordova.d.ts" />
/// <reference path="../typings/dialogs.d.ts" />
"use strict";
var LocalPackage = require("./localPackage");
var RemotePackage = require("./remotePackage");
var CodePushUtil = require("./codePushUtil");
var NativeAppInfo = require("./nativeAppInfo");
var Sdk = require("./sdk");
var SyncStatus = require("./syncStatus");
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
            var callback = function (error, remotePackageOrUpdateNotification) {
                if (error) {
                    CodePushUtil.invokeErrorCallback(error, queryError);
                }
                else {
                    var appUpToDate = function () {
                        CodePushUtil.logMessage("The application is up to date.");
                        querySuccess && querySuccess(null);
                    };
                    if (remotePackageOrUpdateNotification) {
                        if (remotePackageOrUpdateNotification.updateAppVersion) {
                            appUpToDate();
                        }
                        else {
                            var remotePackage = remotePackageOrUpdateNotification;
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
                                CodePushUtil.logMessage("An update is available. " + JSON.stringify(result));
                                querySuccess && querySuccess(result);
                            });
                        }
                    }
                    else {
                        appUpToDate();
                    }
                }
            };
            Sdk.getAcquisitionManager(function (initError, acquisitionManager) {
                if (initError) {
                    CodePushUtil.invokeErrorCallback(initError, queryError);
                }
                else {
                    LocalPackage.getCurrentOrDefaultPackage(function (localPackage) {
                        acquisitionManager.queryUpdateWithCurrentPackage(localPackage, callback);
                    }, function (error) {
                        CodePushUtil.invokeErrorCallback(error, queryError);
                    });
                }
            });
        }
        catch (e) {
            CodePushUtil.invokeErrorCallback(new Error("An error occurred while querying for updates." + CodePushUtil.getErrorMessage(e)), queryError);
        }
    };
    CodePush.prototype.sync = function (syncCallback, syncOptions) {
        if (!syncOptions) {
            syncOptions = this.getDefaultSyncOptions();
        }
        if (syncOptions.mandatoryUpdateMessage) {
            syncOptions.mandatoryContinueButtonLabel = syncOptions.mandatoryContinueButtonLabel || this.getDefaultSyncOptions().mandatoryContinueButtonLabel;
            syncOptions.updateTitle = syncOptions.updateTitle || this.getDefaultSyncOptions().updateTitle;
        }
        if (syncOptions.optionalUpdateMessage) {
            syncOptions.optionalInstallButtonLabel = syncOptions.optionalInstallButtonLabel || this.getDefaultSyncOptions().optionalInstallButtonLabel;
            syncOptions.optionalIgnoreButtonLabel = syncOptions.optionalIgnoreButtonLabel || this.getDefaultSyncOptions().optionalIgnoreButtonLabel;
            syncOptions.updateTitle = syncOptions.updateTitle || this.getDefaultSyncOptions().updateTitle;
        }
        if (typeof syncOptions.ignoreFailedUpdates !== typeof true) {
            syncOptions.ignoreFailedUpdates = true;
        }
        if (syncOptions.appendReleaseDescription && !syncOptions.descriptionPrefix) {
            syncOptions.descriptionPrefix = this.getDefaultSyncOptions().descriptionPrefix;
        }
        window.codePush.notifyApplicationReady();
        var onError = function (error) {
            CodePushUtil.logError("An error occurred during sync.", error);
            syncCallback && syncCallback(SyncStatus.ERROR);
        };
        var onApplySuccess = function () {
            syncCallback && syncCallback(SyncStatus.APPLY_SUCCESS);
        };
        var onDownloadSuccess = function (localPackage) {
            localPackage.apply(onApplySuccess, onError, syncOptions.rollbackTimeout);
        };
        var downloadAndInstallUpdate = function (remotePackage) {
            remotePackage.download(onDownloadSuccess, onError);
        };
        var onUpdate = function (remotePackage) {
            if (!remotePackage || (remotePackage.failedApply && syncOptions.ignoreFailedUpdates)) {
                syncCallback && syncCallback(SyncStatus.UP_TO_DATE);
            }
            else {
                if (remotePackage.isMandatory && syncOptions.mandatoryUpdateMessage) {
                    var message = syncOptions.appendReleaseDescription ? syncOptions.mandatoryUpdateMessage + syncOptions.descriptionPrefix + remotePackage.description : syncOptions.mandatoryUpdateMessage;
                    navigator.notification.alert(message, function () { downloadAndInstallUpdate(remotePackage); }, syncOptions.updateTitle, syncOptions.mandatoryContinueButtonLabel);
                }
                else if (!remotePackage.isMandatory && syncOptions.optionalUpdateMessage) {
                    var optionalUpdateCallback = function (buttonIndex) {
                        switch (buttonIndex) {
                            case 1:
                                downloadAndInstallUpdate(remotePackage);
                                break;
                            case 2:
                            default:
                                syncCallback && syncCallback(SyncStatus.UPDATE_IGNORED);
                                break;
                        }
                    };
                    var message = syncOptions.appendReleaseDescription ? syncOptions.optionalUpdateMessage + syncOptions.descriptionPrefix + remotePackage.description : syncOptions.optionalUpdateMessage;
                    navigator.notification.confirm(message, optionalUpdateCallback, syncOptions.updateTitle, [syncOptions.optionalInstallButtonLabel, syncOptions.optionalIgnoreButtonLabel]);
                }
                else {
                    downloadAndInstallUpdate(remotePackage);
                }
            }
        };
        window.codePush.checkForUpdate(onUpdate, onError);
    };
    CodePush.prototype.getDefaultSyncOptions = function () {
        if (!CodePush.DefaultSyncOptions) {
            CodePush.DefaultSyncOptions = {
                updateTitle: "Update",
                mandatoryUpdateMessage: "You will be updated to the latest version.",
                mandatoryContinueButtonLabel: "Continue",
                optionalUpdateMessage: "An update is available. Would you like to install it?",
                optionalInstallButtonLabel: "Install",
                optionalIgnoreButtonLabel: "Ignore",
                rollbackTimeout: 0,
                ignoreFailedUpdates: true,
                appendReleaseDescription: false,
                descriptionPrefix: " Description: "
            };
        }
        return CodePush.DefaultSyncOptions;
    };
    return CodePush;
})();
var instance = new CodePush();
module.exports = instance;

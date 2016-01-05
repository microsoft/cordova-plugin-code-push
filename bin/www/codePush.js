
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
    CodePush.prototype.checkForUpdate = function (querySuccess, queryError, deploymentKey) {
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
                            NativeAppInfo.isFailedUpdate(remotePackage.packageHash, function (installFailed) {
                                var result = new RemotePackage();
                                result.appVersion = remotePackage.appVersion;
                                result.deploymentKey = remotePackage.deploymentKey;
                                result.description = remotePackage.description;
                                result.downloadUrl = remotePackage.downloadUrl;
                                result.isMandatory = remotePackage.isMandatory;
                                result.label = remotePackage.label;
                                result.packageHash = remotePackage.packageHash;
                                result.packageSize = remotePackage.packageSize;
                                result.failedInstall = installFailed;
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
            }, deploymentKey);
        }
        catch (e) {
            CodePushUtil.invokeErrorCallback(new Error("An error occurred while querying for updates." + CodePushUtil.getErrorMessage(e)), queryError);
        }
    };
    CodePush.prototype.sync = function (syncCallback, syncOptions, downloadProgress) {
        if (!syncOptions) {
            syncOptions = this.getDefaultSyncOptions();
        }
        else {
            var defaultDialogOptions = this.getDefaultUpdateDialogOptions();
            if (syncOptions.updateDialog) {
                if (typeof syncOptions.updateDialog !== typeof ({})) {
                    syncOptions.updateDialog = defaultDialogOptions;
                }
                else {
                    CodePushUtil.copyUnassignedMembers(defaultDialogOptions, syncOptions.updateDialog);
                }
            }
            var defaultOptions = this.getDefaultSyncOptions();
            CodePushUtil.copyUnassignedMembers(defaultOptions, syncOptions);
        }
        window.codePush.notifyApplicationReady();
        var onError = function (error) {
            CodePushUtil.logError("An error occurred during sync.", error);
            syncCallback && syncCallback(SyncStatus.ERROR);
        };
        var onInstallSuccess = function () {
            syncCallback && syncCallback(SyncStatus.UPDATE_INSTALLED);
        };
        var onDownloadSuccess = function (localPackage) {
            syncCallback && syncCallback(SyncStatus.INSTALLING_UPDATE);
            localPackage.install(onInstallSuccess, onError, syncOptions);
        };
        var downloadAndInstallUpdate = function (remotePackage) {
            syncCallback && syncCallback(SyncStatus.DOWNLOADING_PACKAGE);
            remotePackage.download(onDownloadSuccess, onError, downloadProgress);
        };
        var onUpdate = function (remotePackage) {
            if (!remotePackage || (remotePackage.failedInstall && syncOptions.ignoreFailedUpdates)) {
                syncCallback && syncCallback(SyncStatus.UP_TO_DATE);
            }
            else {
                var dlgOpts = syncOptions.updateDialog;
                if (dlgOpts) {
                    syncCallback && syncCallback(SyncStatus.AWAITING_USER_ACTION);
                }
                if (remotePackage.isMandatory && syncOptions.updateDialog) {
                    var message = dlgOpts.appendReleaseDescription ?
                        dlgOpts.mandatoryUpdateMessage + dlgOpts.descriptionPrefix + remotePackage.description
                        : dlgOpts.mandatoryUpdateMessage;
                    navigator.notification.alert(message, function () { downloadAndInstallUpdate(remotePackage); }, dlgOpts.updateTitle, dlgOpts.mandatoryContinueButtonLabel);
                }
                else if (!remotePackage.isMandatory && syncOptions.updateDialog) {
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
                    var message = dlgOpts.appendReleaseDescription ?
                        dlgOpts.optionalUpdateMessage + dlgOpts.descriptionPrefix + remotePackage.description
                        : dlgOpts.optionalUpdateMessage;
                    navigator.notification.confirm(message, optionalUpdateCallback, dlgOpts.updateTitle, [dlgOpts.optionalInstallButtonLabel, dlgOpts.optionalIgnoreButtonLabel]);
                }
                else {
                    downloadAndInstallUpdate(remotePackage);
                }
            }
        };
        syncCallback && syncCallback(SyncStatus.CHECKING_FOR_UPDATE);
        window.codePush.checkForUpdate(onUpdate, onError, syncOptions.deploymentKey);
    };
    CodePush.prototype.getDefaultSyncOptions = function () {
        if (!CodePush.DefaultSyncOptions) {
            CodePush.DefaultSyncOptions = {
                ignoreFailedUpdates: true,
                installMode: InstallMode.ON_NEXT_RESTART,
                updateDialog: false,
                deploymentKey: undefined
            };
        }
        return CodePush.DefaultSyncOptions;
    };
    CodePush.prototype.getDefaultUpdateDialogOptions = function () {
        if (!CodePush.DefaultUpdateDialogOptions) {
            CodePush.DefaultUpdateDialogOptions = {
                updateTitle: "Update",
                mandatoryUpdateMessage: "You will be updated to the latest version.",
                mandatoryContinueButtonLabel: "Continue",
                optionalUpdateMessage: "An update is available. Would you like to install it?",
                optionalInstallButtonLabel: "Install",
                optionalIgnoreButtonLabel: "Ignore",
                appendReleaseDescription: false,
                descriptionPrefix: " Description: "
            };
        }
        return CodePush.DefaultUpdateDialogOptions;
    };
    return CodePush;
})();
var instance = new CodePush();
module.exports = instance;

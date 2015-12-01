/// <reference path="../typings/codePush.d.ts" />
/// <reference path="../typings/fileSystem.d.ts" />
/// <reference path="../typings/fileTransfer.d.ts" />
/// <reference path="../typings/cordova.d.ts" />
/// <reference path="../typings/dialogs.d.ts" />

"use strict";

declare var zip: any;
declare var cordova: Cordova;

import LocalPackage = require("./localPackage");
import RemotePackage = require("./remotePackage");
import CodePushUtil = require("./codePushUtil");
import NativeAppInfo = require("./nativeAppInfo");
import Sdk = require("./sdk");
import SyncStatus = require("./syncStatus");

/**
 * This is the entry point to Cordova CodePush SDK.
 * It provides the following features to the app developer:
 * - polling the server for new versions of the app
 * - notifying the plugin that the application loaded successfully after an update
 * - getting information about the currently deployed package
 */
class CodePush implements CodePushCordovaPlugin {
    /**
     * The default options for the sync command.
     */
    private static DefaultSyncOptions: SyncOptions;
    /**
     * The default UI for the update dialog, in case it is enabled.
     * Please note that the update dialog is disabled by default. 
     */
    private static DefaultUpdateDialogOptions: UpdateDialogOptions;
    
    /**
      * Notifies the plugin that the update operation succeeded and that the application is ready.
      * Calling this function is required if a rollbackTimeout parameter is used for your LocalPackage.install() call.
      * If install() is used without a rollbackTimeout, calling this function is a noop.
      * 
      * @param notifySucceeded Optional callback invoked if the plugin was successfully notified.
      * @param notifyFailed Optional callback invoked in case of an error during notifying the plugin.
      */
    public notifyApplicationReady(notifySucceeded?: SuccessCallback<void>, notifyFailed?: ErrorCallback): void {
        cordova.exec(notifySucceeded, notifyFailed, "CodePush", "updateSuccess", []);
    }
    
    /**
    * Get the current package information.
    * 
    * @param packageSuccess Callback invoked with the currently deployed package information.
    * @param packageError Optional callback invoked in case of an error.
    */
    public getCurrentPackage(packageSuccess: SuccessCallback<LocalPackage>, packageError?: ErrorCallback): void {
        return LocalPackage.getPackageInfoOrNull(LocalPackage.PackageInfoFile, packageSuccess, packageError);
    }

    /**
     * Checks with the CodePush server if an update package is available for download.
     *
     * @param querySuccess Callback invoked in case of a successful response from the server.
     *                     The callback takes one RemotePackage parameter. A non-null package is a valid update.
     *                     A null package means the application is up to date for the current native application version.
     * @param queryError Optional callback invoked in case of an error.
     */
    public checkForUpdate(querySuccess: SuccessCallback<RemotePackage>, queryError?: ErrorCallback): void {
        try {
            var callback: Callback<RemotePackage | NativeUpdateNotification> = (error: Error, remotePackageOrUpdateNotification: IRemotePackage | NativeUpdateNotification) => {
                if (error) {
                    CodePushUtil.invokeErrorCallback(error, queryError);
                }
                else {
                    var appUpToDate = () => {
                        CodePushUtil.logMessage("The application is up to date.");
                        querySuccess && querySuccess(null);
                    };

                    if (remotePackageOrUpdateNotification) {
                        if ((<NativeUpdateNotification>remotePackageOrUpdateNotification).updateAppVersion) {
                            /* There is an update available for a different version. In the current version of the plugin, we treat that as no update. */
                            appUpToDate();
                        } else {
                            /* There is an update available for the current version. */
                            var remotePackage: RemotePackage = <RemotePackage>remotePackageOrUpdateNotification;
                            NativeAppInfo.isFailedUpdate(remotePackage.packageHash, (installFailed: boolean) => {
                                var result: RemotePackage = new RemotePackage();
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

            Sdk.getAcquisitionManager((initError: Error, acquisitionManager: AcquisitionManager) => {
                if (initError) {
                    CodePushUtil.invokeErrorCallback(initError, queryError);
                } else {
                    LocalPackage.getCurrentOrDefaultPackage((localPackage: LocalPackage) => {
                        acquisitionManager.queryUpdateWithCurrentPackage(localPackage, callback);
                    }, (error: Error) => {
                        CodePushUtil.invokeErrorCallback(error, queryError);
                    });
                }
            });
        } catch (e) {
            CodePushUtil.invokeErrorCallback(new Error("An error occurred while querying for updates." + CodePushUtil.getErrorMessage(e)), queryError);
        }
    }
    
    /**
     * Convenience method for installing updates in one method call.
     * This method is provided for simplicity, and its behavior can be replicated by using window.codePush.checkForUpdate(), RemotePackage's download() and LocalPackage's install() methods.
     *  
     * The algorithm of this method is the following:
     * - Checks for an update on the CodePush server.
     * - If an update is available
     *         - If the update is mandatory and the alertMessage is set in options, the user will be informed that the application will be updated to the latest version.
     *           The update package will then be downloaded and applied. 
     *         - If the update is not mandatory and the confirmMessage is set in options, the user will be asked if they want to update to the latest version.
     *           If they decline, the syncCallback will be invoked with SyncStatus.UPDATE_IGNORED. 
     *         - Otherwise, the update package will be downloaded and applied with no user interaction.
     * - If no update is available on the server, the syncCallback will be invoked with the SyncStatus.UP_TO_DATE.
     * - If an error occurs during checking for update, downloading or installing it, the syncCallback will be invoked with the SyncStatus.ERROR.
     * 
     * @param syncCallback Optional callback to be called with the status of the sync operation.
     *                     The callback will be called only once, and the possible statuses are defined by the SyncStatus enum. 
     * @param syncOptions Optional SyncOptions parameter configuring the behavior of the sync operation.
     * 
     */
    public sync(syncCallback?: SuccessCallback<any>, syncOptions?: SyncOptions): void {

        /* No options were specified, use default */
        if (!syncOptions) {
            syncOptions = this.getDefaultSyncOptions();
        } else {
            /* Some options were specified */
            /* Handle dialog options */
            var defaultDialogOptions = this.getDefaultUpdateDialogOptions();
            if (syncOptions.updateDialog) {
                if (typeof syncOptions.updateDialog !== typeof ({})) {
                    /* updateDialog set to truey condition, use default options */
                    syncOptions.updateDialog = defaultDialogOptions;
                } else {
                    /* some options were specified, merge with default */
                    CodePushUtil.copyUnassignedMembers(defaultDialogOptions, syncOptions.updateDialog);
                }
            }

            /* Handle other options. Dialog options will not be overwritten. */
            var defaultOptions = this.getDefaultSyncOptions();
            CodePushUtil.copyUnassignedMembers(defaultOptions, syncOptions);
        }

        window.codePush.notifyApplicationReady();

        var onError = (error: Error) => {
            CodePushUtil.logError("An error occurred during sync.", error);
            syncCallback && syncCallback(SyncStatus.ERROR);
        };

        var onInstallSuccess = () => {
            syncCallback && syncCallback(SyncStatus.UPDATE_INSTALLED);
        };

        var onDownloadSuccess = (localPackage: ILocalPackage) => {
            localPackage.install(onInstallSuccess, onError, syncOptions);
        };

        var downloadAndInstallUpdate = (remotePackage: RemotePackage) => {
            remotePackage.download(onDownloadSuccess, onError);
        };

        var onUpdate = (remotePackage: RemotePackage) => {
            if (!remotePackage || (remotePackage.failedInstall && syncOptions.ignoreFailedUpdates)) {
                syncCallback && syncCallback(SyncStatus.UP_TO_DATE);
            } else {
                var dlgOpts: UpdateDialogOptions = <UpdateDialogOptions>syncOptions.updateDialog;
                if (remotePackage.isMandatory && syncOptions.updateDialog) {
                    /* Alert user */
                    var message = dlgOpts.appendReleaseDescription ?
                        dlgOpts.mandatoryUpdateMessage + dlgOpts.descriptionPrefix + remotePackage.description
                        : dlgOpts.mandatoryUpdateMessage;
                    navigator.notification.alert(message, () => { downloadAndInstallUpdate(remotePackage); }, dlgOpts.updateTitle, dlgOpts.mandatoryContinueButtonLabel);
                } else if (!remotePackage.isMandatory && syncOptions.updateDialog) {
                    /* Confirm update with user */
                    var optionalUpdateCallback = (buttonIndex: number) => {
                        switch (buttonIndex) {
                            case 1:
                                /* Install */
                                downloadAndInstallUpdate(remotePackage);
                                break;
                            case 2:
                            default:
                                /* Cancel */
                                syncCallback && syncCallback(SyncStatus.UPDATE_IGNORED);
                                break;
                        }
                    };

                    var message = dlgOpts.appendReleaseDescription ?
                        dlgOpts.optionalUpdateMessage + dlgOpts.descriptionPrefix + remotePackage.description
                        : dlgOpts.optionalUpdateMessage;
                    navigator.notification.confirm(message, optionalUpdateCallback, dlgOpts.updateTitle, [dlgOpts.optionalInstallButtonLabel, dlgOpts.optionalIgnoreButtonLabel]);
                } else {
                    /* No user interaction */
                    downloadAndInstallUpdate(remotePackage);
                }
            }
        };

        window.codePush.checkForUpdate(onUpdate, onError);
    }

    /**
     * Returns the default options for the CodePush sync operation.
     * If the options are not defined yet, the static DefaultSyncOptions member will be instantiated.
     */
    private getDefaultSyncOptions(): SyncOptions {
        if (!CodePush.DefaultSyncOptions) {
            CodePush.DefaultSyncOptions = {
                rollbackTimeout: 0,
                ignoreFailedUpdates: true,
                installMode: InstallMode.ON_NEXT_RESTART,
                updateDialog: false
            };
        }

        return CodePush.DefaultSyncOptions;
    }
    
    /**
     * Returns the default options for the update dialog.
     * Please note that the dialog is disabled by default.
     */
    private getDefaultUpdateDialogOptions(): UpdateDialogOptions {
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
    }

}

var instance = new CodePush();
export = instance;

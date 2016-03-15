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
     * Calling this function is required on the first run after an update. On every subsequent application run, calling this function is a noop.
     * If using sync API, calling this function is not required since sync calls it internally. 
     * 
     * @param notifySucceeded Optional callback invoked if the plugin was successfully notified.
     * @param notifyFailed Optional callback invoked in case of an error during notifying the plugin.
     */
    public notifyApplicationReady(notifySucceeded?: SuccessCallback<void>, notifyFailed?: ErrorCallback): void {
        cordova.exec(notifySucceeded, notifyFailed, "CodePush", "updateSuccess", []);
    }
    
    /**
     * Reloads the application. If there is a pending update package installed using ON_NEXT_RESTART or ON_NEXT_RESUME modes, the update
     * will be immediately visible to the user. Otherwise, calling this function will simply reload the current version of the application.
     */
    public restartApplication(installSuccess: SuccessCallback<void>, errorCallback?: ErrorCallback): void {
        cordova.exec(installSuccess, errorCallback, "CodePush", "restartApplication", []);
    }
    
    /**
     * Reports an application status back to the server.
     * !!! This function is called from the native side, please make changes accordingly. !!!
     */
    public reportStatus(status: number, label: string, appVersion: string, deploymentKey: string) {
        try {
            console.log("Reporting status: " + status + " " + label + " " + appVersion);

            var createPackageForReporting = (label: string, appVersion: string): IPackage => {
                return {
                    /* The SDK only reports the label and appVersion.
                       The rest of the properties are added for type safety. */
                    label: label, appVersion: appVersion,
                    deploymentKey: deploymentKey, description: null,
                    isMandatory: false, packageHash: null,
                    packageSize: null, failedInstall: false
                };
            };

            switch (status) {
                case ReportStatus.STORE_VERSION:
                    Sdk.reportStatusDeploy(null, AcquisitionStatus.DeploymentSucceeded, deploymentKey);
                    break;
                case ReportStatus.UPDATE_CONFIRMED:
                    Sdk.reportStatusDeploy(createPackageForReporting(label, appVersion), AcquisitionStatus.DeploymentSucceeded, deploymentKey);
                    break;
                case ReportStatus.UPDATE_ROLLED_BACK:
                    Sdk.reportStatusDeploy(createPackageForReporting(label, appVersion), AcquisitionStatus.DeploymentFailed, deploymentKey);
                    break;
            }
        } catch (e) {
            CodePushUtil.logError("An error occurred while reporting." + CodePushUtil.getErrorMessage(e));
        }
    }
    
    /**
     * Get the current package information.
     * 
     * @param packageSuccess Callback invoked with the currently deployed package information.
     * @param packageError Optional callback invoked in case of an error.
     */
    public getCurrentPackage(packageSuccess: SuccessCallback<LocalPackage>, packageError?: ErrorCallback): void {
        NativeAppInfo.isPendingUpdate((pendingUpdate: boolean) => {
            var packageInfoFile = pendingUpdate ? LocalPackage.OldPackageInfoFile : LocalPackage.PackageInfoFile;
            LocalPackage.getPackageInfoOrNull(packageInfoFile, packageSuccess, packageError);
        });
    }

    /**
     * Gets the pending package information, if any. A pending package is one that has been installed but the application still runs the old code.
     * This happends only after a package has been installed using ON_NEXT_RESTART or ON_NEXT_RESUME mode, but the application was not restarted/resumed yet.
     */
    public getPendingPackage(packageSuccess: SuccessCallback<ILocalPackage>, packageError?: ErrorCallback): void {
        NativeAppInfo.isPendingUpdate((pendingUpdate: boolean) => {
            if (pendingUpdate) {
                LocalPackage.getPackageInfoOrNull(LocalPackage.PackageInfoFile, packageSuccess, packageError);
            } else {
                packageSuccess(null);
            }
        });
    }

    /**
     * Checks with the CodePush server if an update package is available for download.
     *
     * @param querySuccess Callback invoked in case of a successful response from the server.
     *                     The callback takes one RemotePackage parameter. A non-null package is a valid update.
     *                     A null package means the application is up to date for the current native application version.
     * @param queryError Optional callback invoked in case of an error.
     * @param deploymentKey Optional deployment key that overrides the config.xml setting.
     */
    public checkForUpdate(querySuccess: SuccessCallback<RemotePackage>, queryError?: ErrorCallback, deploymentKey?: string): void {
        try {
            var callback: Callback<RemotePackage | NativeUpdateNotification> = (error: Error, remotePackageOrUpdateNotification: IRemotePackage | NativeUpdateNotification) => {
                if (error) {
                    CodePushUtil.invokeErrorCallback(error, queryError);
                }
                else {
                    var appUpToDate = () => {
                        CodePushUtil.logMessage("App is up to date.");
                        querySuccess && querySuccess(null);
                    };

                    if (remotePackageOrUpdateNotification) {
                        if ((<NativeUpdateNotification>remotePackageOrUpdateNotification).updateAppVersion) {
                            /* There is an update available for a different version. In the current version of the plugin, we treat that as no update. */
                            CodePushUtil.logMessage("An update is available, but it is targetting a newer binary version than you are currently running.");
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
                        CodePushUtil.logMessage("Checking for update.");
                        acquisitionManager.queryUpdateWithCurrentPackage(localPackage, callback);
                    }, (error: Error) => {
                        CodePushUtil.invokeErrorCallback(error, queryError);
                    });
                }
            }, deploymentKey);
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
     * @param downloadProgress Optional callback invoked during the download process. It is called several times with one DownloadProgress parameter.
     * 
     */
    public sync(syncCallback?: SuccessCallback<any>, syncOptions?: SyncOptions, downloadProgress?: SuccessCallback<DownloadProgress>): void {

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
            switch (syncOptions.installMode) {
                case InstallMode.ON_NEXT_RESTART:
                    CodePushUtil.logMessage("Update is installed and will be run on the next app restart.");
                    break;
                    
                case InstallMode.ON_NEXT_RESUME:
                    CodePushUtil.logMessage("Update is installed and will be run when the app next resumes.");
                    break;
            }
            
            syncCallback && syncCallback(SyncStatus.UPDATE_INSTALLED);
        };

        var onDownloadSuccess = (localPackage: ILocalPackage) => {
            syncCallback && syncCallback(SyncStatus.INSTALLING_UPDATE);
            localPackage.install(onInstallSuccess, onError, syncOptions);
        };

        var downloadAndInstallUpdate = (remotePackage: RemotePackage) => {
            syncCallback && syncCallback(SyncStatus.DOWNLOADING_PACKAGE);
            remotePackage.download(onDownloadSuccess, onError, downloadProgress);
        };

        var onUpdate = (remotePackage: RemotePackage) => {
            var updateShouldBeIgnored = remotePackage && (remotePackage.failedInstall && syncOptions.ignoreFailedUpdates);
            if (!remotePackage || updateShouldBeIgnored) {
                if (updateShouldBeIgnored) {
                    CodePushUtil.logMessage("An update is available, but it is being ignored due to have been previously rolled back.");
                }
                
                syncCallback && syncCallback(SyncStatus.UP_TO_DATE);
            } else {
                var dlgOpts: UpdateDialogOptions = <UpdateDialogOptions>syncOptions.updateDialog;
                if (dlgOpts) {
                    CodePushUtil.logMessage("Awaiting user action.");
                    syncCallback && syncCallback(SyncStatus.AWAITING_USER_ACTION);
                }
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
                                CodePushUtil.logMessage("User cancelled the update.");
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

        syncCallback && syncCallback(SyncStatus.CHECKING_FOR_UPDATE);
        window.codePush.checkForUpdate(onUpdate, onError, syncOptions.deploymentKey);
    }

    /**
     * Returns the default options for the CodePush sync operation.
     * If the options are not defined yet, the static DefaultSyncOptions member will be instantiated.
     */
    private getDefaultSyncOptions(): SyncOptions {
        if (!CodePush.DefaultSyncOptions) {
            CodePush.DefaultSyncOptions = {
                ignoreFailedUpdates: true,
                installMode: InstallMode.ON_NEXT_RESTART,
                updateDialog: false,
                deploymentKey: undefined
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
                updateTitle: "Update available",
                mandatoryUpdateMessage: "An update is available that must be installed.",
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

/**
 * Defines the application statuses reported from the native layer.
 * !!! This enum is defined in native code as well, please make changes accordingly. !!!
 */
enum ReportStatus {
    STORE_VERSION = 0,
    UPDATE_CONFIRMED = 1,
    UPDATE_ROLLED_BACK = 2
}


var instance = new CodePush();
export = instance;

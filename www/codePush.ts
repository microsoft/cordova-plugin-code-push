/// <reference path="../typings/codePush.d.ts" />
/// <reference path="../typings/fileSystem.d.ts" />
/// <reference path="../typings/fileTransfer.d.ts" />
/// <reference path="../typings/cordova.d.ts" />

"use strict";

declare var zip: any;
declare var cordova: Cordova;

import LocalPackage = require("./localPackage");
import RemotePackage = require("./remotePackage");
import HttpRequester = require("./httpRequester");
import CallbackUtil = require("./callbackUtil");
import NativeAppInfo = require("./nativeAppInfo");

/**
 * This is the entry point to Cordova Code Push SDK.
 * It provides the following features to the app developer:
 * - polling the server for new versions of the app
 * - notifying the plugin that the application loaded successfully after an update
 * - getting information about the currently deployed package
 */
class CodePush implements CodePushCordovaPlugin {
    /**
      * Notifies the plugin that the update operation succeeded and that the application is ready.
      * Calling this function is required if a rollbackTimeout parameter is used for your LocalPackage.apply() call.
      * If apply() is used without a rollbackTimeout, calling this function is a noop.
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
     * Checks with the Code Push server if an update package is available for download.
     *
     * @param querySuccess Callback invoked in case of a successful response from the server.
     *                     The callback takes one RemotePackage parameter. A non-null package is a valid update.
     *                     A null package means the application is up to date.
     * @param queryError Optional callback invoked in case of an error.
     */
    public checkForUpdate(querySuccess: SuccessCallback<RemotePackage>, queryError?: ErrorCallback): void {
        try {
            var callback: Callback<RemotePackage> = (error: Error, remotePackage: IRemotePackage) => {
                if (error) {
                    queryError && queryError(error);
                }
                else {
                    if (remotePackage) {
                        NativeAppInfo.applyFailed(remotePackage.packageHash, (applyFailed: boolean) => {
                            var result: RemotePackage = new RemotePackage();
                            result.appVersion = remotePackage.appVersion;
                            result.deploymentKey = remotePackage.deploymentKey;
                            result.description = remotePackage.description;
                            result.downloadUrl = remotePackage.downloadUrl;
                            result.isMandatory = remotePackage.isMandatory;
                            result.label = remotePackage.label;
                            result.packageHash = remotePackage.packageHash;
                            result.packageSize = remotePackage.packageSize;
                            result.failedApply = applyFailed;
                            querySuccess(result);
                        });
                    }
                    else {
                        querySuccess(null);
                    }
                }
            };

            this.createAcquisitionManager((initError: Error, acquisitionManager: AcquisitionManager) => {
                if (initError) {
                    queryError && queryError(initError);
                } else {
                    LocalPackage.getCurrentOrDefaultPackage((localPackage: LocalPackage) => {
                        acquisitionManager.queryUpdateWithCurrentPackage(localPackage, callback);
                    }, (error: Error) => {
                        queryError && queryError(error);
                    });
                }
            });
        } catch (e) {
            queryError && queryError(new Error("An error ocurred while querying for updates." + CallbackUtil.getErrorMessage(e)));
        }
    }

    /**
     * Reads the Code Push configuration and creates an AcquisitionManager instance using it.
     */
    private createAcquisitionManager(callback: Callback<AcquisitionManager>): void {
        NativeAppInfo.getServerURL((serverError: Error, serverURL: string) => {
            NativeAppInfo.getDeploymentKey((depolymentKeyError: Error, deploymentKey: string) => {
                if (!serverURL || !deploymentKey) {
                    callback(new Error("Could not get the Code Push configuration. Please check your config.xml file."), null);
                } else {
                    var configuration: Configuration = { deploymentKey: deploymentKey, serverUrl: serverURL, ignoreAppVersion: false };
                    var acquisitionManager: AcquisitionManager = new AcquisitionManager(new HttpRequester(), configuration);
                    callback(null, acquisitionManager);
                }
            });
        });
    }
}

var instance = new CodePush();
export = instance;

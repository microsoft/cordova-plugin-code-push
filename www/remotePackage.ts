/// <reference path="../typings/codePush.d.ts" />
/// <reference path="../typings/fileTransfer.d.ts" />

"use strict";

declare var cordova: Cordova;

import LocalPackage = require("./localPackage");
import Package = require("./package");
import NativeAppInfo = require("./nativeAppInfo");
import CallbackUtil = require("./callbackUtil");

/**
 * Defines a remote package, which represents an update package available for download.
 */
class RemotePackage extends Package implements IRemotePackage {

    private currentFileTransfer: FileTransfer;

    /**
     * The URL at which the package is available for download.
     */
    public downloadUrl: string;
    
    /**
     * Downloads the package update from the Code Push service.
     * 
     * @param downloadSuccess Called with one parameter, the downloaded package information, once the download completed successfully.
     * @param downloadError Optional callback invoked in case of an error.
     */
    public download(successCallback: SuccessCallback<LocalPackage>, errorCallback?: ErrorCallback): void {
        try {
            CallbackUtil.logMessage("Downloading update package ...");
            if (!this.downloadUrl) {
                CallbackUtil.logAndForwardError(new Error("The remote package does not contain a download URL."), errorCallback);
            } else {
                this.currentFileTransfer = new FileTransfer();

                var downloadSuccess = (fileEntry: FileEntry) => {
                    this.currentFileTransfer = null;

                    fileEntry.file((file: File) => {

                        NativeAppInfo.isFailedUpdate(this.packageHash, (applyFailed: boolean) => {
                            var localPackage = new LocalPackage();
                            localPackage.deploymentKey = this.deploymentKey;
                            localPackage.description = this.description;
                            localPackage.label = this.label;
                            localPackage.appVersion = this.appVersion;
                            localPackage.isMandatory = this.isMandatory;
                            localPackage.packageHash = this.packageHash;
                            localPackage.isFirstRun = false;
                            localPackage.failedApply = applyFailed;
                            localPackage.localPath = fileEntry.toInternalURL();
                            
                            CallbackUtil.logMessage("Package download success: " + JSON.stringify(localPackage));
                            successCallback && successCallback(localPackage);
                        });
                    }, (fileError: FileError) => {
                        CallbackUtil.logAndForwardError(new Error("Could not access local package. Error code: " + fileError.code), errorCallback);
                    });
                };

                var downloadError = (error: FileTransferError) => {
                    this.currentFileTransfer = null;
                    CallbackUtil.logAndForwardError(new Error(error.body), errorCallback);
                };

                this.currentFileTransfer.download(this.downloadUrl, cordova.file.dataDirectory + LocalPackage.DownloadDir + "/" + LocalPackage.PackageUpdateFileName, downloadSuccess, downloadError, true);
            }
        } catch (e) {
            CallbackUtil.logAndForwardError(new Error("An error ocurred while downloading the package. " + (e && e.message) ? e.message : ""), errorCallback);
        }
    }
    
    /**
     * Aborts the current download session, previously started with download().
     * 
     * @param abortSuccess Optional callback invoked if the abort operation succeeded.
     * @param abortError Optional callback invoked in case of an error.
     */
    public abortDownload(abortSuccess?: SuccessCallback<void>, abortError?: ErrorCallback): void {
        try {
            if (this.currentFileTransfer) {
                this.currentFileTransfer.abort();
            
                /* abort succeeded */
                abortSuccess && abortSuccess();
            }
        } catch (e) {
            /* abort failed */
            abortError && abortError(e);
        }
    }
}

export = RemotePackage;
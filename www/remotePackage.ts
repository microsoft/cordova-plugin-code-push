/// <reference path="../typings/codePush.d.ts" />

"use strict";

declare var cordova: Cordova;

import LocalPackage = require("./localPackage");
import Package = require("./package");
import NativeAppInfo = require("./nativeAppInfo");
import CodePushUtil = require("./codePushUtil");
import FileDownloader = require("./fileDownloader");
import Sdk = require("./sdk");

/**
 * Defines a remote package, which represents an update package available for download.
 */
class RemotePackage extends Package implements IRemotePackage {

    private currentFileTransfer: FileDownloader;

    /**
     * The URL at which the package is available for download.
     */
    public downloadUrl: string;

    /**
     * Downloads the package update from the CodePush service.
     *
     * @param successCallback Called with one parameter, the downloaded package information, once the download completed successfully.
     * @param errorCallback Optional callback invoked in case of an error.
     * @param downloadProgress Optional callback invoked during the download process. It is called several times with one DownloadProgress parameter.
     */
    public download(successCallback: SuccessCallback<LocalPackage>, errorCallback?: ErrorCallback, downloadProgress?: SuccessCallback<DownloadProgress>): void {
        try {
            CodePushUtil.logMessage("Downloading update");
            if (!this.downloadUrl) {
                CodePushUtil.invokeErrorCallback(new Error("The remote package does not contain a download URL."), errorCallback);
            } else {
                this.currentFileTransfer = new FileDownloader();

                const downloadSuccess = (fileEntry: FileEntry) => {
                    this.currentFileTransfer = null;

                    fileEntry.file((file: File) => {

                        NativeAppInfo.isFailedUpdate(this.packageHash, (installFailed: boolean) => {
                            const localPackage = new LocalPackage();
                            localPackage.deploymentKey = this.deploymentKey;
                            localPackage.description = this.description;
                            localPackage.label = this.label;
                            localPackage.appVersion = this.appVersion;
                            localPackage.isMandatory = this.isMandatory;
                            localPackage.packageHash = this.packageHash;
                            localPackage.isFirstRun = false;
                            localPackage.failedInstall = installFailed;
                            localPackage.localPath = fileEntry.toInternalURL();

                            CodePushUtil.logMessage("Package download success: " + JSON.stringify(localPackage));
                            successCallback && successCallback(localPackage);
                            Sdk.reportStatusDownload(localPackage, localPackage.deploymentKey);
                        });
                    }, (fileError: FileError) => {
                        CodePushUtil.invokeErrorCallback(new Error("Could not access local package. Error code: " + fileError.code), errorCallback);
                    });
                };

                const downloadError = (error: FileError) => {
                    this.currentFileTransfer = null;
                    CodePushUtil.invokeErrorCallback(new Error("Could not access file system. Error code: " + error.code), errorCallback);
                };

                this.currentFileTransfer.onprogress = (progressEvent: ProgressEvent) => {
                    if (downloadProgress) {
                        const dp: DownloadProgress = {
                            receivedBytes: progressEvent.loaded,
                            totalBytes: progressEvent.total
                        };
                        downloadProgress(dp);
                    }
                };

                this.currentFileTransfer.download(this.downloadUrl, cordova.file.dataDirectory + LocalPackage.DownloadDir + "/" + LocalPackage.PackageUpdateFileName, downloadSuccess, downloadError);
            }
        } catch (e) {
            CodePushUtil.invokeErrorCallback(new Error("An error occured while downloading the package. " + (e && e.message) ? e.message : ""), errorCallback);
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
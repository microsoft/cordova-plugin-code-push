/// <reference path="../typings/codePush.d.ts" />
/// <reference types="cordova-plugin-file" />

"use strict";

declare var cordova: Cordova & { plugin: { http: AdvancedHttp.Plugin }};

import LocalPackage = require("./localPackage");
import Package = require("./package");
import FileUtil = require("./fileUtil");
import NativeAppInfo = require("./nativeAppInfo");
import CodePushUtil = require("./codePushUtil");
import Sdk = require("./sdk");

/**
 * Defines a remote package, which represents an update package available for download.
 */
class RemotePackage extends Package implements IRemotePackage {

    constructor() {
        super();

        /**
         * @see https://github.com/microsoft/cordova-plugin-code-push/pull/513#pullrequestreview-449368983
         */
        FileUtil.getDataDirectory(LocalPackage.DownloadDir, true, (error: Error, _: DirectoryEntry) => {
            /*
             * TODO: errors must be strongly checked, via named subclassing & instanceof
             * or common (const) enum property of error payload i.e.:
             *      if error.kind === ErrorKind.PermissionDeniedError
             */
            if (error) {
                CodePushUtil.logError("Can't create directory for download update.", error);
            }
        });
    }

    private isDownloading: boolean = false;

    /**
     * The URL at which the package is available for download.
     */
    public downloadUrl: string;

    /**
     * Downloads the package update from the CodePush service.
     *
     * @param downloadSuccess Called with one parameter, the downloaded package information, once the download completed successfully.
     * @param downloadError Optional callback invoked in case of an error.
     * @param downloadProgress Optional callback invoked during the download process. It is called several times with one DownloadProgress parameter.
     */
    public download(successCallback: SuccessCallback<LocalPackage>, errorCallback?: ErrorCallback, downloadProgress?: SuccessCallback<DownloadProgress>): void {
        try {
            CodePushUtil.logMessage("Downloading update");
            if (!this.downloadUrl) {
                CodePushUtil.invokeErrorCallback(new Error("The remote package does not contain a download URL."), errorCallback);
            } else {
                this.isDownloading = true;

                const onFileError: FileSaverErrorHandler = (fileError: FileError, stage: string) => {
                    const error = new Error("Could not access local package. Stage:" + stage + "Error code: " + fileError.code);
                    CodePushUtil.invokeErrorCallback(error, errorCallback);
                    CodePushUtil.logMessage(stage + ":" + fileError);
                    this.isDownloading = false;
                };

                const onFileReady: FileSaverCompletionHandler = (fileEntry: FileEntry) => {
                    this.isDownloading = false;

                    fileEntry.file((file: File) => {

                        NativeAppInfo.isFailedUpdate(this.packageHash, (installFailed: boolean) => {
                            var localPackage = new LocalPackage();
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
                    }, fileError => onFileError(fileError, "READ_FILE"));
                };

                const filedir = cordova.file.dataDirectory + LocalPackage.DownloadDir + "/";
                const filename = LocalPackage.PackageUpdateFileName;

                cordova.plugin.http.downloadFile(this.downloadUrl, {}, {}, filedir + filename, onFileReady, onFileError);
            }
        } catch (e) {
            CodePushUtil.invokeErrorCallback(new Error("An error occurred while downloading the package. " + (e && e.message) ? e.message : ""), errorCallback);
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
            if (this.isDownloading) {
                this.isDownloading = false;

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

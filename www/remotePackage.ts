/// <reference path="../typings/codePush.d.ts" />
/// <reference types="cordova-plugin-file" />

"use strict";

declare var cordova: Cordova;

import LocalPackage = require("./localPackage");
import Package = require("./package");
import NativeAppInfo = require("./nativeAppInfo");
import CodePushUtil = require("./codePushUtil");
import Sdk = require("./sdk");

// Types used in file handling
/**
 * A function which accepts @type {FileEntry} containing a file
 */
type FileSaverCompletionHandler = (entry: FileEntry) => void;
/**
 * A function which is called if file handling has failed
 */
type FileSaverErrorHandler = (error: FileError, at: string) => void;

/**
 * Defines a remote package, which represents an update package available for download.
 */
class RemotePackage extends Package implements IRemotePackage {

    private currentFileTransfer: XMLHttpRequest;

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
                this.currentFileTransfer = new XMLHttpRequest();
                this.currentFileTransfer.responseType = 'blob';
                this.currentFileTransfer.open('GET', this.downloadUrl, true);

                const onFileError: FileSaverErrorHandler = (fileError: FileError, stage: string) => {
                    const error = new Error("Could not access local package. Stage:" + stage + "Error code: " + fileError.code);
                    CodePushUtil.invokeErrorCallback(error, errorCallback);
                    CodePushUtil.logMessage(stage + ":" + fileError)
                    this.currentFileTransfer = null;
                };

                const onFileReady: FileSaverCompletionHandler = (fileEntry: FileEntry) => {
                    this.currentFileTransfer = null;

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
                }

                this.currentFileTransfer.addEventListener('load', (progressEvent: ProgressEvent) => {
                    const ok = this.currentFileTransfer.status === 200;

                    if (!ok) {
                        CodePushUtil.invokeErrorCallback(new Error(this.currentFileTransfer.statusText), errorCallback);
                    } else {
                        const filedir = cordova.file.dataDirectory + LocalPackage.DownloadDir + "/";
                        const filename = LocalPackage.PackageUpdateFileName;

                        RemotePackage.saveFile(this.currentFileTransfer.response, filedir + filename, onFileReady, onFileError)
                    }

                });

                this.currentFileTransfer.addEventListener('error', (progressEvent: ProgressEvent) => {
                    this.currentFileTransfer = null;
                    CodePushUtil.invokeErrorCallback(new Error(this.currentFileTransfer.statusText), errorCallback);
                })

                this.currentFileTransfer.addEventListener('progress', (progressEvent: ProgressEvent) => {
                    if (downloadProgress) {
                        var dp: DownloadProgress = { receivedBytes: progressEvent.loaded, totalBytes: progressEvent.total };
                        downloadProgress(dp);
                    }
                });

                this.currentFileTransfer.send()
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

    private static saveFile(data: Blob, filePath: string, onFileReady: FileSaverCompletionHandler, onFileError: FileSaverErrorHandler) {
        // Wrap error handler for convenience
        const errorHandler = (at: string) => (error: FileError) => onFileError(error, at);

        window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function openFs(fs: FileSystem) {

            fs.root.getFile(filePath, { create: true, exclusive: false }, function makeEntry(fileEntry: FileEntry) {

                fileEntry.createWriter(function writeFile(writer: FileWriter) {

                    writer.addEventListener('writeend', (e: ProgressEvent) => {
                        CodePushUtil.logMessage("Wrote file to" + fileEntry.fullPath);
                        onFileReady(fileEntry);
                    })
                    writer.write(data);

                }, errorHandler("WRITE_FILE"))
            }, errorHandler("MAKE_ENTRY"));
        }, errorHandler("OPEN_FS"));
    }
}

export = RemotePackage;

/*
 *******************************************************
 *                                                     *
 *   Copyright (C) Microsoft. All rights reserved.     *
 *                                                     *
 *******************************************************
 */

/// <reference path="./typings/codePush.d.ts" />
/// <reference path="./typings/fileSystem.d.ts" />
/// <reference path="./typings/fileTransfer.d.ts" />
/// <reference path="./typings/cordova.d.ts" />

"use strict";

declare var zip: any;
declare var cordova: Cordova;

/**
 * This is the entry point to Cordova Code Push SDK.
 * It provides the following features to the app developer:
 * - polling the server for new versions of the app
 * - downloading new versions locally
 * - unpacking and applying the update
 * - launching the child app
 */
class CodePush implements CodePushCordovaPlugin {
    private static RootDir: string = "codepush";

    private static DiffManifestFile: string = "hotcodepush.json";
    private static PackageInfoFile: string = "currentPackage.json";
    private static OldPackageInfoFile: string = "oldPackage.json";
    private static PackageUpdateFileName: string = "update.zip";

    private static DownloadDir: string = CodePush.RootDir + "/download";
    private static DownloadUnzipDir: string = CodePush.DownloadDir + "/unzipped";
    private static DeployDir: string = CodePush.RootDir + "/deploy";
    private static VersionsDir: string = CodePush.DeployDir + "/versions";

    private acquisitionManager: AcquisitionManager;
    private appDataDirectory: string;

    private currentFileTransfer: FileTransfer;
    private ignoreAppVersion: boolean;
    private initialized: boolean;

    public onBeforeApply: { (oldPackage: LocalPackage, newPackage: LocalPackage): void };
    public onAfterApply: { (oldPackage: LocalPackage, newPackage: LocalPackage): void };

    constructor(ignoreAppVersion?: boolean) {
        this.initialized = false;
        this.ignoreAppVersion = !!ignoreAppVersion;
    }

    /**
     * Notifies the plugin that the update operation succeeded.
     * Calling this function is required if applyWithRevertProtection() is used for your update.
     * If apply() was used for the update instead, calling this function is a noop.
     * 
     * @param notifySucceeded Optional callback invoked if the plugin was successfully notified.
     * @param notifyFailed Optional callback invoked in case of an error during notifying the plugin.
     */
    public updateSucceeded(notifySucceeded?: SuccessCallback<void>, notifyFailed?: ErrorCallback): void {
        cordova.exec(notifySucceeded, notifyFailed, "CodePush", "updatesuccess", []);
    }
    
    /**
     * Checks if a package update was previously attempted but failed for a given package hash.
     * Every reverted update attempted with applyWithRevertProtection() is stored such that the application developer has the option to ignore
     * updates that previously failed. This way, an infinite update loop can be prevented in case of a bad update package.
     * 
     * @param packageHash String hash of the package update to check.
     * @param checkSucceeded Callback taking one boolean parameter invoked with the result of the check.
     * @param checkFailed Optional callback invoked in case of an error.
     */
    public hasUpdatePreviouslyFailed(packageHash: string, checkSucceeded: SuccessCallback<boolean>, checkFailed?: ErrorCallback): void {
        var win = (failed?: number) => {
            checkSucceeded && checkSucceeded(!!failed);
        };

        var fail = (e?: Error) => {
            checkFailed && checkFailed(e);
        };

        cordova.exec(win, fail, "CodePush", "isfailedupdate", [packageHash]);
    }
    
    /**
     * Get the current package information.
     * 
     * @param packageSuccess Callback invoked with the currently deployed package information.
     * @param packageError Optional callback invoked in case of an error.
     */
    public getCurrentPackage(packageSuccess: SuccessCallback<LocalPackage>, packageError?: ErrorCallback): void {
        var handleError = (e: Error) => {
            packageError && packageError(new Error("Cannot read package information. " + this.getErrorMessage(e)));
        };

        try {
            FileUtil.readDataFile(CodePush.RootDir, CodePush.PackageInfoFile, (error: Error, content: string) => {
                if (error) {
                    handleError(error);
                } else {
                    try {
                        var packageInfo: IPackageInfoMetadata = JSON.parse(content);
                        packageSuccess && packageSuccess(packageInfo);
                    } catch (e) {
                        handleError(e);
                    }
                }
            });
        } catch (e) {
            handleError(e);
        }
    }

    public getCurrentOrDefaultPackage(packageSuccess: SuccessCallback<LocalPackage>, packageError?: ErrorCallback): void {
        var currentPackageFailure = (error: Error) => {
            NativeAppInfo.getApplicationVersion((appVersionError: Error, appVersion: string) => {
                if (appVersionError) {
                    console.log("Could not get application version." + appVersionError);
                    packageError(appVersionError);
                } else {
                    var defaultPackage: LocalPackage = {
                        /* for the default package, we only need the app version */
                        appVersion: appVersion,
                        deploymentKey: null,
                        description: null,
                        isMandatory: null,
                        packageSize: null,
                        label: null,
                        packageHash: null,
                        localPath: null
                    };

                    packageSuccess(defaultPackage);
                }
            });
        };

        this.getCurrentPackage(packageSuccess, currentPackageFailure);
    }
    
    /**
     * Writes the given local package information to the current package information file.
     * @param packageInfoMetadata The object to serialize.
     * @param callback In case of an error, this function will be called with the error as the fist parameter.
     */
    public writeCurrentPackageInformation(packageInfoMetadata: IPackageInfoMetadata, callback: Callback<void>): void {
        var content = JSON.stringify(packageInfoMetadata);
        FileUtil.writeStringToDataFile(content, CodePush.RootDir, CodePush.PackageInfoFile, true, callback);
    }

    /**
     * Backs up the current package information to the old package information file.
     * This file is used for recovery in case of an update going wrong.
     * @param callback In case of an error, this function will be called with the error as the fist parameter.
     */
    public writeOldPackageInformation(callback: Callback<void>): void {
        var reportFileError = (error: FileError) => {
            callback(FileUtil.fileErrorToError(error), null);
        };

        var copyFile = (fileToCopy: FileEntry) => {
            fileToCopy.getParent((parent: DirectoryEntry) => {
                fileToCopy.copyTo(parent, CodePush.OldPackageInfoFile, () => {
                    callback(null, null);
                }, reportFileError);
            }, reportFileError);
        };

        var gotFile = (error: Error, currentPackageFile: FileEntry) => {
            if (error) {
                callback(error, null);
            } else {
                FileUtil.getDataFile(CodePush.RootDir, CodePush.OldPackageInfoFile, false, (error: Error, oldPackageFile: FileEntry) => {
                    if (!error && !!oldPackageFile) {
                        /* file already exists */
                        oldPackageFile.remove(() => {
                            copyFile(currentPackageFile);
                        }, reportFileError);
                    } else {
                        copyFile(currentPackageFile);
                    }
                });
            }
        };

        FileUtil.getDataFile(CodePush.RootDir, CodePush.PackageInfoFile, false, gotFile);
    }
    
    /**
     * Downloads a package update from the Code Push service.
     * 
     * @param package The package to download.
     * @param downloadSuccess Called with one parameter, the downloaded package information, once the download completed successfully.
     * @param downloadError Optional callback invoked in case of an error.
     */
    public download(remotePackage: RemotePackage, successCallback: SuccessCallback<LocalPackage>, errorCallback?: ErrorCallback): void {
        try {
            if (!(remotePackage && remotePackage.downloadUrl)) {
                errorCallback && errorCallback(new Error("The provided remote package does not contain a download URL."));
            } else {
                this.currentFileTransfer = new FileTransfer();

                var downloadSuccess = (fileEntry: FileEntry) => {
                    this.currentFileTransfer = null;

                    fileEntry.file((file: File) => {
                        var localPackage: LocalPackage = {
                            deploymentKey: remotePackage.deploymentKey,
                            description: remotePackage.description,
                            label: remotePackage.label,
                            appVersion: remotePackage.appVersion,
                            isMandatory: remotePackage.isMandatory,
                            packageHash: remotePackage.packageHash,
                            packageSize: file.size,
                            localPath: fileEntry.toInternalURL()
                        };

                        successCallback && successCallback(localPackage);
                    }, (fileError: FileError) => {
                        errorCallback && errorCallback(new Error("Could not access local package. Error code: " + fileError.code));
                    });
                };

                var downloadError = (error: FileTransferError) => {
                    this.currentFileTransfer = null;
                    errorCallback && errorCallback(new Error(error.body));
                };

                this.currentFileTransfer.download(remotePackage.downloadUrl, this.appDataDirectory + CodePush.DownloadDir + "/" + CodePush.PackageUpdateFileName, downloadSuccess, downloadError, true);
            }
        } catch (e) {
            errorCallback && errorCallback(new Error("An error ocurred while downloading the package. " + this.getErrorMessage(e)));
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

    /**
     * Applies a downloaded package.
     * 
     * @param applySuccess Callback invoked if the apply operation succeeded. 
     * @param applyError Optional callback inovoked in case of an error.
     */
    public apply(newPackage: LocalPackage, applySuccess?: SuccessCallback<void>, applyError?: ErrorCallback): void {
        this.applyWithRevertProtection(newPackage, 0, applySuccess, applyError);
    }

    /**
     * Applies a downloaded package with revert protection.
     * If the updateSucceeded() method is not invoked in the time specified by applySuccessTimeoutMillis, the application will be reverted to its previous version.
     * 
     * @param newPackage The package update to apply.
     * @param applySuccessTimeoutMillis The milliseconds interval to wait for updateSucceeded(). If in the given interval a call to updateSucceeded() has not been received, the application is reverted to its previous version.
     * @param applySuccess Callback invoked if the apply operation succeeded. This is the last callback to be invoked after the javascript context is reloaded in the application by launching the updated application.
     *                     Invocation of this callback does not guarantee that the application will not be reverted, since it is invoked before the applySuccessTimeoutMillis countdown starts.
     * @param applyError Optional callback inovoked in case of an error.
     */
    public applyWithRevertProtection(newPackage: LocalPackage, applySuccessTimeoutMillis: number, applySuccess?: SuccessCallback<void>, applyError?: ErrorCallback): void {
        if (!newPackage) {
            applyError && applyError(new Error("Invalid package parameter."));
            return;
        }

        try {
            var newPackageLocation = CodePush.VersionsDir + "/" + newPackage.packageHash;

            var writeNewPackageMetadata = (deployDir: DirectoryEntry, writeMetadataCallback: Callback<void>) => {
                NativeAppInfo.getApplicationBuildTime((buildTimeError: Error, timestamp: string) => {
                    NativeAppInfo.getApplicationVersion((appVersionError: Error, appVersion: string) => {
                        buildTimeError && console.log("Could not get application build time. " + buildTimeError);
                        appVersionError && console.log("Could not get application version." + appVersionError);

                        var currentPackageMetadata: IPackageInfoMetadata = {
                            nativeBuildTime: timestamp,
                            localPath: deployDir.fullPath,
                            appVersion: appVersion,
                            deploymentKey: newPackage.deploymentKey,
                            description: newPackage.description,
                            isMandatory: newPackage.isMandatory,
                            packageSize: newPackage.packageSize,
                            label: newPackage.label,
                            packageHash: newPackage.packageHash
                        };

                        this.writeCurrentPackageInformation(currentPackageMetadata, writeMetadataCallback);
                    });
                });
            };

            var invokeOnApplyCallback = (callback: OnApplyCallback, oldPackage: LocalPackage, newPackage: LocalPackage) => {
                try {
                    callback && callback(oldPackage, newPackage);
                } catch (e) {
                    console.log("An error has occurred during the onApply() callback.");
                }
            };

            var deleteDirectory = (dirLocation: string, deleteDirCallback: Callback<void>) => {
                FileUtil.getDataDirectory(dirLocation, false, (oldDirError: Error, dirToDelete: DirectoryEntry) => {
                    if (oldDirError) {
                        deleteDirCallback(oldDirError, null);
                    } else {
                        var win = () => { deleteDirCallback(null, null); };
                        var fail = (e: FileError) => { deleteDirCallback(FileUtil.fileErrorToError(e), null); };
                        dirToDelete.removeRecursively(win, fail);
                    }
                });
            };

            var cleanOldPackage = (oldPackage: LocalPackage, cleanPackageCallback: Callback<void>) => {
                if (oldPackage && oldPackage.localPath) {
                    deleteDirectory(oldPackage.localPath, cleanPackageCallback);
                } else {
                    cleanPackageCallback(new Error("The package could not be found."), null);
                }
            };

            var donePackageFileCopy = (deployDir: DirectoryEntry) => {
                this.getCurrentOrDefaultPackage((oldPackage: LocalPackage) => {
                    invokeOnApplyCallback(this.onBeforeApply, oldPackage, newPackage);
                    this.writeOldPackageInformation((backupError: Error) => {
                        backupError && console.log("Package information was not backed up. " + this.getErrorMessage(backupError));
                        /* continue on error, current package information might be missing if this is the fist update */
                        writeNewPackageMetadata(deployDir, (writeMetadataError: Error) => {
                            if (writeMetadataError) {
                                applyError && applyError(writeMetadataError);
                            } else {
                                invokeOnApplyCallback(this.onAfterApply, oldPackage, newPackage);
                                var silentCleanup = (cleanCallback: Callback<void>) => {
                                    deleteDirectory(CodePush.DownloadDir, (e1: Error) => {
                                        cleanOldPackage(oldPackage, (e2: Error) => {
                                            cleanCallback(e1 || e2, null);
                                        });
                                    });
                                };

                                var invokeSuccessAndApply = () => {
                                    applySuccess && applySuccess();
                                    /* no neeed for callbacks, the javascript context will reload */
                                    cordova.exec(() => { }, () => { }, "CodePush", "apply", [deployDir.fullPath, applySuccessTimeoutMillis.toString()]);
                                };

                                var preApplySuccess = () => {
                                    if (applySuccessTimeoutMillis > 0) {
                                        /* package will be cleaned up after success, on the native side */
                                        invokeSuccessAndApply();
                                    } else {
                                        /* clean up the package, then invoke apply */
                                        silentCleanup((cleanupError: Error) => {
                                            invokeSuccessAndApply();
                                        });
                                    }
                                };

                                var preApplyFailure = (applyError?: any) => {
                                    var error = new Error("An error has ocurred while applying the package. " + this.getErrorMessage(applyError));
                                    applyError && applyError(error);
                                };

                                cordova.exec(preApplySuccess, preApplyFailure, "CodePush", "preapply", [deployDir.fullPath]);
                            }
                        });
                    });
                }, applyError);
            };

            var handleCleanDeployment = (cleanDeployCallback: Callback<void>) => {
                // no diff manifest
                FileUtil.getDataDirectory(newPackageLocation, true, (deployDirError: Error, deployDir: DirectoryEntry) => {
                    FileUtil.getDataDirectory(CodePush.DownloadUnzipDir, false, (unzipDirErr: Error, unzipDir: DirectoryEntry) => {
                        if (unzipDirErr || deployDirError) {
                            cleanDeployCallback(new Error("Could not copy new package."), null);
                        } else {
                            FileUtil.copyDirectoryEntriesTo(unzipDir, deployDir, (copyError: Error) => {
                                if (copyError) {
                                    cleanDeployCallback(copyError, null);
                                } else {
                                    cleanDeployCallback(null, null);
                                }
                            });
                        }
                    });
                });
            };
            var copyCurrentPackage = (copyCallback: Callback<void>) => {
                FileUtil.getDataDirectory(newPackageLocation, true, (deployDirError: Error, deployDir: DirectoryEntry) => {
                    this.getCurrentPackage((currentPackage: LocalPackage) => {
                        if (deployDirError) {
                            applyError && applyError(new Error("Could not acquire the source/destination folders. "));
                        } else {
                            var success = (currentPackageDirectory: DirectoryEntry) => {
                                FileUtil.copyDirectoryEntriesTo(currentPackageDirectory, deployDir, copyCallback);
                            };

                            var fail = (fileSystemError: FileError) => {
                                copyCallback(FileUtil.fileErrorToError(fileSystemError), null);
                            };

                            window.resolveLocalFileSystemURL(currentPackage.localPath, success, fail);
                        }
                    }, applyError);
                });
            };

            var handleDiffDeployment = (diffManifest: FileEntry) => {
                /* copy old files */
                copyCurrentPackage((currentPackageError: Error) => {
                    /* copy new files */
                    handleCleanDeployment((cleanDeployError: Error) => {
                        /* delete files mentioned in the manifest */
                        var diffContent = FileUtil.readFileEntry(diffManifest, (error: Error, content: string) => {
                            if (error || currentPackageError || cleanDeployError) {
                                applyError && applyError(new Error("Cannot perform diff-update."));
                            } else {
                                var manifest: IDiffManifest = JSON.parse(content);
                                FileUtil.deleteEntriesFromDataDirectory(newPackageLocation, manifest.deletedFiles, (deleteError: Error) => {
                                    FileUtil.getDataDirectory(newPackageLocation, true, (deployDirError: Error, deployDir: DirectoryEntry) => {
                                        if (deleteError || deployDirError) {
                                            applyError && applyError(new Error("Cannot clean up deleted manifest files."));
                                        } else {
                                            donePackageFileCopy(deployDir);
                                        }
                                    });
                                });
                            }
                        });
                    });
                });
            };

            var newPackageUnzipped = (unzipError: any) => {
                if (unzipError) {
                    applyError && applyError(new Error("Could not unzip package. " + this.getErrorMessage(unzipError)));
                } else {
                    FileUtil.getDataDirectory(newPackageLocation, true, (deployDirError: Error, deployDir: DirectoryEntry) => {
                        // check for diff manifest
                        FileUtil.getDataFile(CodePush.DownloadUnzipDir, CodePush.DiffManifestFile, false, (manifestError: Error, diffManifest: FileEntry) => {
                            if (!manifestError && !!diffManifest) {
                                handleDiffDeployment(diffManifest);
                            } else {
                                handleCleanDeployment(() => {
                                    donePackageFileCopy(deployDir);
                                });
                            }
                        });
                    });
                }
            };

            FileUtil.getDataDirectory(CodePush.DownloadUnzipDir, false, (error: Error, directoryEntry: DirectoryEntry) => {
                var unzipPackage = () => {
                    FileUtil.getDataDirectory(CodePush.DownloadUnzipDir, true, (innerError: Error, unzipDir: DirectoryEntry) => {
                        if (innerError) {
                            applyError && applyError(innerError);
                        } else {
                            zip.unzip(newPackage.localPath, unzipDir.toInternalURL(), newPackageUnzipped);
                        }
                    });
                };

                if (!error && !!directoryEntry) {
                    /* Unzip directory not clean */
                    directoryEntry.removeRecursively(() => {
                        unzipPackage();
                    }, (cleanupError: FileError) => {
                        applyError && applyError(FileUtil.fileErrorToError(cleanupError));
                    });
                } else {
                    unzipPackage();
                }
            });
        } catch (e) {
            applyError && applyError(new Error("An error ocurred while applying the package. " + this.getErrorMessage(e)));
        }
    }

    /**
     * Queries the Code Push server for updates.
     *
     * @param querySuccess Callback invoked in case of a successful response from the server.
     *                     The callback takes one RemotePackage parameter. A non-null package is a valid update.
     *                     A null package means the application is up to date.
     * @param queryError Optional callback invoked in case of an error.
     */
    public queryUpdate(querySuccess: SuccessCallback<RemotePackage>, queryError?: ErrorCallback): void {
        try {
            var callback: Callback<RemotePackage> = this.getNodeStyleCallbackFor(querySuccess, queryError);
            this.initialize((initError: Error) => {
                if (initError) {
                    queryError && queryError(initError);
                } else {
                    this.getCurrentOrDefaultPackage((localPackage: LocalPackage) => {
                        this.acquisitionManager.queryUpdateWithCurrentPackage(localPackage, callback);
                    }, (error: Error) => {
                        queryError && queryError(error);
                    });
                }
            });
        } catch (e) {
            queryError && queryError(new Error("An error ocurred while querying for updates." + this.getErrorMessage(e)));
        }
    }

    private initialize(callback: Callback<void>): void {
        if (!this.initialized) {
            NativeAppInfo.getServerURL((serverError: Error, serverURL: string) => {
                NativeAppInfo.getDeploymentKey((depolymentKeyError: Error, deploymentKey: string) => {
                    if (!serverURL || !deploymentKey) {
                        callback(new Error("Could not get the Code Push configuration. Please check your config.xml file."), null);
                    } else {
                        var configuration: Configuration = { deploymentKey: deploymentKey, serverUrl: serverURL, ignoreAppVersion: this.ignoreAppVersion };
                        this.appDataDirectory = cordova.file.dataDirectory;
                        this.acquisitionManager = new AcquisitionManager(new HttpRequester(), configuration);
                        this.initialized = true;
                        callback(null, null);
                    }
                });
            });
        } else {
            /* already initialized */
            callback(null, null);
        }
    }
    
    /**
     * Given two Cordova style callbacks for success and error, this function returns a node.js
     * style callback where the error is the first parameter and the result the second.
     */
    private getNodeStyleCallbackFor<T>(successCallback: SuccessCallback<T>, errorCallback: ErrorCallback): Callback<T> {
        return (error: Error, result: T) => {
            if (error) {
                errorCallback && errorCallback(error);
            } else {
                successCallback && successCallback(result);
            }
        };
    }
    
    /**
     * Gets the message of an error, if any.
     */
    private getErrorMessage(e: Error): string {
        var result: string;

        if (e && e.message) {
            return e.message;
        }

        return result;
    }
}

/**
 * Defines the JSON format of the current package information file.
 * This file is stored in the local storage of the device and persists between store updates and code-push updates.
 * 
 * !! THIS FILE IS READ FROM NATIVE CODE AS WELL. ANY CHANGES TO THIS INTERFACE NEEDS TO BE UPDATED IN NATIVE CODE !!
 */
interface IPackageInfoMetadata extends LocalPackage {
    nativeBuildTime: string;
}

/**
 * Defines the JSON format of the package diff manifest file.
 */
interface IDiffManifest {
    deletedFiles: string[];
}

/**
 * File utilities for Code Push.
 */
class FileUtil {
    public static directoryExists(rootUri: string, path: string, callback: Callback<boolean>): void {
        FileUtil.getDirectory(rootUri, path, false, (error: Error, dirEntry: DirectoryEntry) => {
            var dirExists: boolean = !error && !!dirEntry;
            callback(null, dirExists);
        });
    }

    public static fileErrorToError(fileError: FileError, message?: string): Error {
        return new Error((message ? message : "An error has occurred while performing the operation. ") + " Error code: " + fileError.code);
    }

    public static getDataDirectory(path: string, createIfNotExists: boolean, callback: Callback<DirectoryEntry>): void {
        FileUtil.getDirectory(cordova.file.dataDirectory, path, createIfNotExists, callback);
    }

    public static writeStringToDataFile(content: string, path: string, fileName: string, createIfNotExists: boolean, callback: Callback<void>): void {
        FileUtil.writeStringToFile(content, cordova.file.dataDirectory, path, fileName, createIfNotExists, callback);
    }

    public static getApplicationDirectory(path: string, callback: Callback<DirectoryEntry>): void {
        FileUtil.getApplicationEntry<DirectoryEntry>(path, callback);
    }

    public static getApplicationFile(path: string, callback: Callback<FileEntry>): void {
        FileUtil.getApplicationEntry<FileEntry>(path, callback);
    }

    public static getOrCreateFile(parent: DirectoryEntry, path: string, createIfNotExists: boolean, success: (result: FileEntry) => void, fail: (error: FileError) => void): void {
        var failFirst = (error: FileError) => {
            if (!createIfNotExists) {
                fail(error);
            } else {
                parent.getFile(path, { create: true, exclusive: false }, success, fail);
            }
        };

        /* check if the file exists first */
        parent.getFile(path, { create: false, exclusive: false }, success, failFirst);
    }

    public static getFile(rootUri: string, path: string, fileName: string, createIfNotExists: boolean, callback: Callback<FileEntry>): void {
        FileUtil.getDirectory(rootUri, path, createIfNotExists, (error: Error, directoryEntry: DirectoryEntry) => {
            if (error) {
                callback(error, null);
            } else {
                FileUtil.getOrCreateFile(directoryEntry, fileName, createIfNotExists,
                    (entry: FileEntry) => { callback(null, entry); },
                    (error: FileError) => { callback(FileUtil.fileErrorToError(error), null); });
            }
        });
    }

    public static getDataFile(path: string, fileName: string, createIfNotExists: boolean, callback: Callback<FileEntry>): void {
        FileUtil.getFile(cordova.file.dataDirectory, path, fileName, createIfNotExists, callback);
    }

    public static fileExists(rootUri: string, path: string, fileName: string, callback: Callback<boolean>): void {
        FileUtil.getFile(rootUri, path, fileName, false, (error: Error, fileEntry: FileEntry) => {
            var exists: boolean = !error && !!fileEntry;
            callback(null, exists);
        });
    }
    
    /**
     * Gets a DirectoryEntry based on a path.
     */
    public static getDirectory(rootUri: string, path: string, createIfNotExists: boolean, callback: Callback<DirectoryEntry>): void {
        var pathArray: string[] = path.split("/");

        var currentDir: DirectoryEntry;
        var currentIndex = 0;

        var appDirError = (error: FileError): void => {
            callback(new Error("Could not get application subdirectory. Error code: " + error.code), null);
        };

        var rootDirSuccess = (appDir: DirectoryEntry): void => {
            if (!createIfNotExists) {
                appDir.getDirectory(path, { create: false, exclusive: false }, (directoryEntry: DirectoryEntry) => { callback(null, directoryEntry); }, appDirError);
            } else {
                currentDir = appDir;
                if (currentIndex >= pathArray.length) {
                    callback(null, appDir);
                } else {
                    var currentPath = pathArray[currentIndex];
                    currentIndex++;

                    if (currentPath) {
                        /* Recursively call rootDirSuccess for all path segments */
                        FileUtil.getOrCreateSubDirectory(appDir, currentPath, createIfNotExists, rootDirSuccess, appDirError);
                    } else {
                        /* Array has empty string elements, possibly due to leading or trailing slashes*/
                        rootDirSuccess(appDir);
                    }
                }
            }
        };

        window.resolveLocalFileSystemURL(rootUri, rootDirSuccess, appDirError);
    }

    public static dataDirectoryExists(path: string, callback: Callback<boolean>): void {
        FileUtil.directoryExists(cordova.file.dataDirectory, path, callback);
    }

    public static copyDirectoryEntriesTo(sourceDir: DirectoryEntry, destinationDir: DirectoryEntry, callback: Callback<void>): void {

        var fail = (error: FileError) => {
            callback(FileUtil.fileErrorToError(error), null);
        };

        var success = (entries: Entry[]) => {
            var i = 0;

            var copyOne = () => {
                if (i < entries.length) {
                    var nextEntry = entries[i++];
                    /* recursively call copyOne on copy success */

                    var entryAlreadyInDestination = (destinationEntry: Entry) => {
                        var replaceError = (fileError: FileError) => {
                            callback(new Error("Error during entry replacement. Error code: " + fileError.code), null);
                        };

                        if (destinationEntry.isDirectory) {
                            /* directory */
                            FileUtil.copyDirectoryEntriesTo(<DirectoryEntry>nextEntry, <DirectoryEntry>destinationEntry, (error: Error) => {
                                if (error) {
                                    callback(error, null);
                                } else {
                                    copyOne();
                                }
                            });
                        } else {
                            /* file */
                            var fileEntry = <FileEntry>destinationEntry;
                            fileEntry.remove(() => {
                                nextEntry.copyTo(destinationDir, nextEntry.name, copyOne, fail);
                            }, replaceError);
                        }
                    };

                    var entryNotInDestination = (error: FileError) => {
                        /* just copy directory to destination */
                        nextEntry.copyTo(destinationDir, nextEntry.name, copyOne, fail);
                    };

                    if (nextEntry.isDirectory) {
                        destinationDir.getDirectory(nextEntry.name, { create: false, exclusive: false }, entryAlreadyInDestination, entryNotInDestination);
                    } else {
                        destinationDir.getFile(nextEntry.name, { create: false, exclusive: false }, entryAlreadyInDestination, entryNotInDestination);
                    }
                } else {
                    /* copied all successfully */
                    callback(null, null);
                }
            };

            copyOne();
        };

        var directoryReader = sourceDir.createReader();
        directoryReader.readEntries(success, fail);
    }

    public static deleteEntriesFromDataDirectory(dirPath: string, filesToDelete: string[], callback: Callback<void>): void {
        FileUtil.getDataDirectory(dirPath, false, (error: Error, rootDir: DirectoryEntry) => {
            if (error) {
                callback(error, null);
            } else {
                var i = 0;

                var deleteOne = () => {
                    if (i < filesToDelete.length) {
                        var continueDeleting = () => {
                            i++;
                            deleteOne();
                        };

                        var fail = (error: FileError) => {
                            console.log("Could not delete file: " + filesToDelete[i]);
                            /* If delete fails, silently continue */
                            continueDeleting();
                        };

                        var success = (entry: FileEntry) => {
                            entry.remove(continueDeleting, fail);
                        };

                        rootDir.getFile(filesToDelete[i], { create: false, exclusive: false }, success, fail);
                    } else {
                        callback(null, null);
                    }
                };

                deleteOne();
            }
        });
    }

    public static writeStringToFile(content: string, rootUri: string, path: string, fileName: string, createIfNotExists: boolean, callback: Callback<void>): void {
        var gotFile = (fileEntry: FileEntry) => {
            fileEntry.createWriter((writer: FileWriter) => {
                writer.onwriteend = (ev: ProgressEvent) => {
                    callback(null, null);
                };

                writer.onerror = (ev: ProgressEvent) => {
                    callback(writer.error, null);
                };

                writer.write(<any>content);
            }, (error: FileError) => {
                callback(new Error("Could write the current package information file. Error code: " + error.code), null);
            });
        };

        FileUtil.getFile(rootUri, path, fileName, createIfNotExists, (error: Error, fileEntry: FileEntry) => {
            if (error) {
                callback(error, null);
            } else {
                gotFile(fileEntry);
            }
        });
    }

    public static readFileEntry(fileEntry: FileEntry, callback: Callback<string>): void {
        fileEntry.file((file: File) => {
            var fileReader = new FileReader();
            fileReader.onloadend = (ev: any) => {
                callback(null, ev.target.result);
            };

            fileReader.onerror = (ev: ErrorEvent) => {
                callback(new Error("Could not get file. Error: " + ev.error), null);
            };

            fileReader.readAsText(file);
        }, (error: FileError) => {
            callback(new Error("Could not get file. Error code: " + error.code), null);
        });
    }

    public static readFile(rootUri: string, path: string, fileName: string, callback: Callback<string>): void {
        FileUtil.getFile(rootUri, path, fileName, false, (error: Error, fileEntry: FileEntry) => {
            if (error) {
                callback(error, null);
            } else {
                FileUtil.readFileEntry(fileEntry, callback);
            }
        });
    }

    public static readDataFile(path: string, fileName: string, callback: Callback<string>): void {
        FileUtil.readFile(cordova.file.dataDirectory, path, fileName, callback);
    }

    private static getApplicationEntry<T extends Entry>(path: string, callback: Callback<T>): void {
        var success = (entry: T) => {
            callback(null, entry);
        };

        var fail = (error: FileError) => {
            callback(FileUtil.fileErrorToError(error), null);
        };

        window.resolveLocalFileSystemURL(cordova.file.applicationDirectory + path, success, fail);
    }

    private static getOrCreateSubDirectory(parent: DirectoryEntry, path: string, createIfNotExists: boolean, success: (result: DirectoryEntry) => void, fail: (error: FileError) => void): void {
        var failFirst = (error: FileError) => {
            if (!createIfNotExists) {
                fail(error);
            } else {
                parent.getDirectory(path, { create: true, exclusive: false }, success, fail);
            }
        };

        /* check if the directory exists first */
        parent.getDirectory(path, { create: false, exclusive: false }, success, failFirst);
    }
}

/**
 * XMLHttpRequest-based implementation of Http.Requester.
 */
class HttpRequester implements Http.Requester {
    public request(verb: Http.Verb, url: string, callbackOrRequestBody: Callback<Http.Response> | string, callback?: Callback<Http.Response>): void {
        var requestBody: string;
        var requestCallback: Callback<Http.Response> = callback;

        if (!requestCallback && typeof callbackOrRequestBody === "function") {
            requestCallback = <Callback<Http.Response>>callbackOrRequestBody;
        }

        if (typeof callbackOrRequestBody === "string") {
            requestBody = <string>callbackOrRequestBody;
        }

        var xhr = new XMLHttpRequest();
        var methodName = this.getHttpMethodName(verb);
        var callbackInvoked: boolean = false;
        xhr.onreadystatechange = function(): void {
            if (xhr.readyState === 4) {
                if (callbackInvoked) {
                    console.warn("Callback already invoked before.");
                }

                var response: Http.Response = { statusCode: xhr.status, body: xhr.responseText };
                requestCallback && requestCallback(null, response);
                callbackInvoked = true;
            }
        };
        xhr.open(methodName, url, true);
        xhr.send(requestBody);
    }

    /**
     * Gets the HTTP method name as a string.
     * The reason for which this is needed is because the Http.Verb enum is defined as a constant => Verb[Verb.METHOD_NAME] is not defined in the compiled JS.
     */
    private getHttpMethodName(verb: Http.Verb): string {
        switch (verb) {
            case Http.Verb.GET:
                return "GET";
            case Http.Verb.CONNECT:
                return "CONNECT";
            case Http.Verb.DELETE:
                return "DELETE";
            case Http.Verb.HEAD:
                return "HEAD";
            case Http.Verb.OPTIONS:
                return "OPTIONS";
            case Http.Verb.PATCH:
                return "PATCH";
            case Http.Verb.POST:
                return "POST";
            case Http.Verb.PUT:
                return "PUT";
            case Http.Verb.TRACE:
                return "TRACE";
            default:
                return null;
        }
    }
}

/**
 * Provides information about the native app.
 */
class NativeAppInfo {
    /**
     * Gets the application build timestamp.
     */
    public static getApplicationBuildTime(callback: Callback<String>): void {
        var timestampSuccess = (timestamp?: String) => { callback(null, timestamp); };
        var timestampError = () => { callback(new Error("Could not get application timestamp."), null); };

        cordova.exec(timestampSuccess, timestampError, "CodePush", "getNativeBuildTime", []);
    }

    /**
     * Gets the application version.
     */
    public static getApplicationVersion(callback: Callback<String>): void {
        var versionSuccess = (version?: String) => { callback(null, version); };
        var versionError = () => { callback(new Error("Could not get application version."), null); };

        cordova.exec(versionSuccess, versionError, "CodePush", "getAppVersion", []);
    }
    
    /**
     * Gets the server URL from config.xml by calling into the native platform.
     */
    public static getServerURL(serverCallback: Callback<String>): void {
        var serverSuccess = (serverURL?: String) => { serverCallback(null, serverURL); };
        var serverError = () => { serverCallback(new Error("Server URL not found."), null); };

        cordova.exec(serverSuccess, serverError, "CodePush", "getServerURL", []);
    }

    /**
     * Gets the deployment key from config.xml by calling into the native platform.
     */
    public static getDeploymentKey(deploymentKeyCallback: Callback<String>): void {
        var deploymentSuccess = (deploymentKey?: String) => { deploymentKeyCallback(null, deploymentKey); };
        var deploymentError = () => { deploymentKeyCallback(new Error("Deployment key not found."), null); };

        cordova.exec(deploymentSuccess, deploymentError, "CodePush", "getDeploymentKey", []);
    }
}

var instance = new CodePush();
export = instance;

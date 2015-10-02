/// <reference path="../typings/codePush.d.ts" />

"use strict";

declare var zip: any;

import Package = require("./package");
import NativeAppInfo = require("./nativeAppInfo");
import FileUtil = require("./fileUtil");
import CodePushUtil = require("./codePushUtil");
import Sdk = require("./sdk");

/**
 * Defines a local package. 
 * 
 * !! THIS TYPE IS READ FROM NATIVE CODE AS WELL. ANY CHANGES TO THIS INTERFACE NEEDS TO BE UPDATED IN NATIVE CODE !!
 */
class LocalPackage extends Package implements ILocalPackage {
    public static RootDir: string = "codepush";

    public static DownloadDir: string = LocalPackage.RootDir + "/download";
    private static DownloadUnzipDir: string = LocalPackage.DownloadDir + "/unzipped";
    private static DeployDir: string = LocalPackage.RootDir + "/deploy";
    private static VersionsDir: string = LocalPackage.DeployDir + "/versions";

    public static PackageUpdateFileName: string = "update.zip";
    public static PackageInfoFile: string = "currentPackage.json";
    private static OldPackageInfoFile: string = "oldPackage.json";
    private static DiffManifestFile: string = "hotcodepush.json";
    
    /**
     * The local storage path where this package is located.
     */
    localPath: string;
    
    /**
     * Indicates if this is the current application run is the first one after the package was applied.
     */
    isFirstRun: boolean;
    
    /**
    * Applies this package to the application. The application will be reloaded with this package and on every application launch this package will be loaded.
    * If the rollbackTimeout parameter is provided, the application will wait for a navigator.codePush.notifyApplicationReady() for the given number of milliseconds.
    * If navigator.codePush.notifyApplicationReady() is called before the time period specified by rollbackTimeout, the apply operation is considered a success.
    * Otherwise, the apply operation will be marked as failed, and the application is reverted to its previous version.
    * 
    * @param applySuccess Callback invoked if the apply operation succeeded. 
    * @param applyError Optional callback inovoked in case of an error.
    * @param rollbackTimeout The time interval, in milliseconds, to wait for a notifyApplicationReady() call before marking the apply as failed and reverting to the previous version.
    */
    public apply(applySuccess: SuccessCallback<void>, errorCallbackOrRollbackTimeout?: ErrorCallback | number, rollbackTimeout?: number): void {
        try {
            CodePushUtil.logMessage("Applying update package ...");

            var timeout = 0;
            var applyError: ErrorCallback;
            
            /* Handle parameters */
            if (typeof rollbackTimeout === "number") {
                timeout = rollbackTimeout;
            } else if (!rollbackTimeout && typeof errorCallbackOrRollbackTimeout === "number") {
                timeout = <number>errorCallbackOrRollbackTimeout;
            }

            applyError = (error: Error): void => {
                var errorCallback: ErrorCallback;
                if (typeof errorCallbackOrRollbackTimeout === "function") {
                    errorCallback = <ErrorCallback>errorCallbackOrRollbackTimeout;
                }
                CodePushUtil.invokeErrorCallback(error, errorCallback);
                Sdk.reportStatus(AcquisitionStatus.DeploymentFailed);
            };

            var newPackageLocation = LocalPackage.VersionsDir + "/" + this.packageHash;

            var donePackageFileCopy = (deployDir: DirectoryEntry) => {
                this.localPath = deployDir.fullPath;
                this.finishApply(deployDir, timeout, applySuccess, applyError);
            };

            var newPackageUnzipped = (unzipError: any) => {
                if (unzipError) {
                    applyError && applyError(new Error("Could not unzip package. " + CodePushUtil.getErrorMessage(unzipError)));
                } else {
                    LocalPackage.handleDeployment(newPackageLocation, CodePushUtil.getNodeStyleCallbackFor<DirectoryEntry>(donePackageFileCopy, applyError));
                }
            };

            FileUtil.getDataDirectory(LocalPackage.DownloadUnzipDir, false, (error: Error, directoryEntry: DirectoryEntry) => {
                var unzipPackage = () => {
                    FileUtil.getDataDirectory(LocalPackage.DownloadUnzipDir, true, (innerError: Error, unzipDir: DirectoryEntry) => {
                        if (innerError) {
                            applyError && applyError(innerError);
                        } else {
                            zip.unzip(this.localPath, unzipDir.toInternalURL(), newPackageUnzipped);
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
            applyError && applyError(new Error("An error ocurred while applying the package. " + CodePushUtil.getErrorMessage(e)));
        }
    }

    private cleanOldPackage(oldPackage: LocalPackage, cleanPackageCallback: Callback<void>): void {
        if (oldPackage && oldPackage.localPath) {
            FileUtil.deleteDirectory(oldPackage.localPath, cleanPackageCallback);
        } else {
            cleanPackageCallback(new Error("The package could not be found."), null);
        }
    };

    private finishApply(deployDir: DirectoryEntry, timeout: number, applySuccess: SuccessCallback<void>, applyError: ErrorCallback): void {
        LocalPackage.getCurrentOrDefaultPackage((oldPackage: LocalPackage) => {
            LocalPackage.backupPackageInformationFile((backupError: Error) => {
                backupError && CodePushUtil.logMessage("First update: back up package information skipped. ");
                /* continue on error, current package information is missing if this is the fist update */
                this.writeNewPackageMetadata(deployDir, (writeMetadataError: Error) => {
                    if (writeMetadataError) {
                        applyError && applyError(writeMetadataError);
                    } else {
                        var silentCleanup = (cleanCallback: Callback<void>) => {
                            FileUtil.deleteDirectory(LocalPackage.DownloadDir, (e1: Error) => {
                                this.cleanOldPackage(oldPackage, (e2: Error) => {
                                    cleanCallback(e1 || e2, null);
                                });
                            });
                        };

                        var invokeSuccessAndApply = () => {
                            CodePushUtil.logMessage("Apply succeeded.");
                            applySuccess && applySuccess();
                            /* no neeed for callbacks, the javascript context will reload */
                            cordova.exec(() => { }, () => { }, "CodePush", "apply", [deployDir.fullPath, timeout.toString()]);
                        };

                        var preApplySuccess = () => {
                            Sdk.reportStatus(AcquisitionStatus.DeploymentSucceeded);
                            if (timeout > 0) {
                                /* package will be cleaned up after success, on the native side */
                                invokeSuccessAndApply();
                            } else {
                                /* clean up the package, then invoke apply */
                                silentCleanup((cleanupError: Error) => {
                                    invokeSuccessAndApply();
                                });
                            }
                        };

                        var preApplyFailure = (preApplyError?: any) => {
                            CodePushUtil.logError("Preapply failure.", preApplyError);
                            var error = new Error("An error has ocurred while applying the package. " + CodePushUtil.getErrorMessage(preApplyError));
                            applyError && applyError(error);
                        };

                        cordova.exec(preApplySuccess, preApplyFailure, "CodePush", "preApply", [deployDir.fullPath]);
                    }
                });
            });
        }, applyError);
    }

    private static handleDeployment(newPackageLocation: string, deployCallback: Callback<DirectoryEntry>): void {
        FileUtil.getDataDirectory(newPackageLocation, true, (deployDirError: Error, deployDir: DirectoryEntry) => {
            // check for diff manifest
            FileUtil.getDataFile(LocalPackage.DownloadUnzipDir, LocalPackage.DiffManifestFile, false, (manifestError: Error, diffManifest: FileEntry) => {
                if (!manifestError && !!diffManifest) {
                    LocalPackage.handleDiffDeployment(newPackageLocation, diffManifest, deployCallback);
                } else {
                    LocalPackage.handleCleanDeployment(newPackageLocation, (error: Error) => {
                        deployCallback(error, deployDir);
                    });
                }
            });
        });
    }

    private writeNewPackageMetadata(deployDir: DirectoryEntry, writeMetadataCallback: Callback<void>): void {
        NativeAppInfo.getApplicationBuildTime((buildTimeError: Error, timestamp: string) => {
            NativeAppInfo.getApplicationVersion((appVersionError: Error, appVersion: string) => {
                buildTimeError && CodePushUtil.logError("Could not get application build time. " + buildTimeError);
                appVersionError && CodePushUtil.logError("Could not get application version." + appVersionError);

                var currentPackageMetadata: IPackageInfoMetadata = {
                    nativeBuildTime: timestamp,
                    localPath: this.localPath,
                    appVersion: appVersion,
                    deploymentKey: this.deploymentKey,
                    description: this.description,
                    isMandatory: this.isMandatory,
                    packageSize: this.packageSize,
                    label: this.label,
                    packageHash: this.packageHash,
                    isFirstRun: false,
                    failedApply: false,
                    apply: undefined
                };

                LocalPackage.writeCurrentPackageInformation(currentPackageMetadata, writeMetadataCallback);
            });
        });
    }

    private static handleCleanDeployment(newPackageLocation: string, cleanDeployCallback: Callback<DirectoryEntry>): void {
        // no diff manifest
        FileUtil.getDataDirectory(newPackageLocation, true, (deployDirError: Error, deployDir: DirectoryEntry) => {
            FileUtil.getDataDirectory(LocalPackage.DownloadUnzipDir, false, (unzipDirErr: Error, unzipDir: DirectoryEntry) => {
                if (unzipDirErr || deployDirError) {
                    cleanDeployCallback(new Error("Could not copy new package."), null);
                } else {
                    FileUtil.copyDirectoryEntriesTo(unzipDir, deployDir, (copyError: Error) => {
                        if (copyError) {
                            cleanDeployCallback(copyError, null);
                        } else {
                            cleanDeployCallback(null, deployDir);
                        }
                    });
                }
            });
        });
    }

    private static copyCurrentPackage(newPackageLocation: string, copyCallback: Callback<void>): void {
        var handleError = (e: Error) => {
            copyCallback && copyCallback(e, null);
        };

        FileUtil.getDataDirectory(newPackageLocation, true, (deployDirError: Error, deployDir: DirectoryEntry) => {
            LocalPackage.getPackage(LocalPackage.PackageInfoFile, (currentPackage: LocalPackage) => {
                if (deployDirError) {
                    handleError(new Error("Could not acquire the source/destination folders. "));
                } else {
                    var success = (currentPackageDirectory: DirectoryEntry) => {
                        FileUtil.copyDirectoryEntriesTo(currentPackageDirectory, deployDir, copyCallback);
                    };

                    var fail = (fileSystemError: FileError) => {
                        copyCallback && copyCallback(FileUtil.fileErrorToError(fileSystemError), null);
                    };

                    FileUtil.getDataDirectory(currentPackage.localPath, false, CodePushUtil.getNodeStyleCallbackFor(success, fail));
                }
            }, handleError);
        });
    }

    private static handleDiffDeployment(newPackageLocation: string, diffManifest: FileEntry, diffCallback: Callback<DirectoryEntry>): void {
        var handleError = (e: Error) => {
            diffCallback(e, null);
        };
        
        /* copy old files */
        LocalPackage.copyCurrentPackage(newPackageLocation, (currentPackageError: Error) => {
            /* copy new files */
            LocalPackage.handleCleanDeployment(newPackageLocation, (cleanDeployError: Error) => {
                /* delete files mentioned in the manifest */
                FileUtil.readFileEntry(diffManifest, (error: Error, content: string) => {
                    if (error || currentPackageError || cleanDeployError) {
                        handleError(new Error("Cannot perform diff-update."));
                    } else {
                        var manifest: IDiffManifest = JSON.parse(content);
                        FileUtil.deleteEntriesFromDataDirectory(newPackageLocation, manifest.deletedFiles, (deleteError: Error) => {
                            FileUtil.getDataDirectory(newPackageLocation, true, (deployDirError: Error, deployDir: DirectoryEntry) => {
                                if (deleteError || deployDirError) {
                                    handleError(new Error("Cannot clean up deleted manifest files."));
                                } else {
                                    diffCallback(null, deployDir);
                                }
                            });
                        });
                    }
                });
            });
        });
    }
    
    /**
    * Writes the given local package information to the current package information file.
    * @param packageInfoMetadata The object to serialize.
    * @param callback In case of an error, this function will be called with the error as the fist parameter.
    */
    public static writeCurrentPackageInformation(packageInfoMetadata: IPackageInfoMetadata, callback: Callback<void>): void {
        var content = JSON.stringify(packageInfoMetadata);
        FileUtil.writeStringToDataFile(content, LocalPackage.RootDir, LocalPackage.PackageInfoFile, true, callback);
    }
    
	/**
     * Backs up the current package information to the old package information file.
     * This file is used for recovery in case of an update going wrong.
     * @param callback In case of an error, this function will be called with the error as the fist parameter.
     */
    public static backupPackageInformationFile(callback: Callback<void>): void {
        var reportFileError = (error: FileError) => {
            callback(FileUtil.fileErrorToError(error), null);
        };

        var copyFile = (fileToCopy: FileEntry) => {
            fileToCopy.getParent((parent: DirectoryEntry) => {
                fileToCopy.copyTo(parent, LocalPackage.OldPackageInfoFile, () => {
                    callback(null, null);
                }, reportFileError);
            }, reportFileError);
        };

        var gotFile = (error: Error, currentPackageFile: FileEntry) => {
            if (error) {
                callback(error, null);
            } else {
                FileUtil.getDataFile(LocalPackage.RootDir, LocalPackage.OldPackageInfoFile, false, (error: Error, oldPackageFile: FileEntry) => {
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

        FileUtil.getDataFile(LocalPackage.RootDir, LocalPackage.PackageInfoFile, false, gotFile);
    }
    
    /**
     * Get the previous package information.
     * 
     * @param packageSuccess Callback invoked with the old package information.
     * @param packageError Optional callback invoked in case of an error.
     */
    public static getOldPackage(packageSuccess: SuccessCallback<LocalPackage>, packageError?: ErrorCallback): void {
        return LocalPackage.getPackage(LocalPackage.OldPackageInfoFile, packageSuccess, packageError);
    }
    
    /**
     * Reads package information from a given file.
     * 
     * @param packageFile The package file name.
     * @param packageSuccess Callback invoked with the package information.
     * @param packageError Optional callback invoked in case of an error.
     */
    public static getPackage(packageFile: string, packageSuccess: SuccessCallback<LocalPackage>, packageError?: ErrorCallback): void {
        var handleError = (e: Error) => {
            packageError && packageError(new Error("Cannot read package information. " + CodePushUtil.getErrorMessage(e)));
        };

        try {
            FileUtil.readDataFile(LocalPackage.RootDir, packageFile, (error: Error, content: string) => {
                if (error) {
                    handleError(error);
                } else {
                    try {
                        var packageInfo: IPackageInfoMetadata = JSON.parse(content);
                        LocalPackage.getLocalPackageFromMetadata(packageInfo, packageSuccess, packageError);
                    } catch (e) {
                        handleError(e);
                    }
                }
            });
        } catch (e) {
            handleError(e);
        }
    }

    private static getLocalPackageFromMetadata(metadata: IPackageInfoMetadata, packageSuccess: SuccessCallback<LocalPackage>, packageError?: ErrorCallback): void {
        if (!metadata) {
            packageError && packageError(new Error("Invalid package metadata."));
        } else {
            NativeAppInfo.isFailedUpdate(metadata.packageHash, (applyFailed: boolean) => {
                NativeAppInfo.isFirstRun(metadata.packageHash, (isFirstRun: boolean) => {
                    var localPackage = new LocalPackage();

                    localPackage.appVersion = metadata.appVersion;
                    localPackage.deploymentKey = metadata.deploymentKey;
                    localPackage.description = metadata.description;
                    localPackage.failedApply = applyFailed;
                    localPackage.isFirstRun = isFirstRun;
                    localPackage.label = metadata.label;
                    localPackage.localPath = metadata.localPath;
                    localPackage.packageHash = metadata.packageHash;
                    localPackage.packageSize = metadata.packageSize;

                    packageSuccess && packageSuccess(localPackage);
                });
            });
        }
    }

    public static getCurrentOrDefaultPackage(packageSuccess: SuccessCallback<LocalPackage>, packageError?: ErrorCallback): void {
        LocalPackage.getPackageInfoOrDefault(LocalPackage.PackageInfoFile, packageSuccess, packageError);
    }

    public static getOldOrDefaultPackage(packageSuccess: SuccessCallback<LocalPackage>, packageError?: ErrorCallback): void {
        LocalPackage.getPackageInfoOrDefault(LocalPackage.OldPackageInfoFile, packageSuccess, packageError);
    }

    public static getPackageInfoOrDefault(packageFile: string, packageSuccess: SuccessCallback<LocalPackage>, packageError?: ErrorCallback): void {
        var packageFailure = (error: Error) => {
            NativeAppInfo.getApplicationVersion((appVersionError: Error, appVersion: string) => {
                if (appVersionError) {
                    CodePushUtil.logError("Could not get application version." + appVersionError);
                    packageError(appVersionError);
                } else {
                    var defaultPackage: LocalPackage = new LocalPackage();
                    /* for the default package, we only need the app version */
                    defaultPackage.appVersion = appVersion;
                    packageSuccess(defaultPackage);
                }
            });
        };

        LocalPackage.getPackage(packageFile, packageSuccess, packageFailure);
    }

    public static getPackageInfoOrNull(packageFile: string, packageSuccess: SuccessCallback<LocalPackage>, packageError?: ErrorCallback): void {
        LocalPackage.getPackage(packageFile, packageSuccess, packageSuccess.bind(null, null));
    }
}

export = LocalPackage;
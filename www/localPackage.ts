/// <reference path="../typings/codePush.d.ts" />

"use strict";

declare var zip: any;

import Package = require("./package");
import NativeAppInfo = require("./nativeAppInfo");
import FileUtil = require("./fileUtil");
import CallbackUtil = require("./callbackUtil");

/**
 * Defines a local package. 
 * 
 * !! THIS TYPE IS READ FROM NATIVE CODE AS WELL. ANY CHANGES TO THIS INTERFACE NEEDS TO BE UPDATED IN NATIVE CODE !!
 */
class LocalPackage extends Package implements ILocalPackage {
    public static RootDir: string = "codepush";

    public static DownloadDir: string = LocalPackage.RootDir + "/download";
    public static DownloadUnzipDir: string = LocalPackage.DownloadDir + "/unzipped";
    public static DeployDir: string = LocalPackage.RootDir + "/deploy";
    public static VersionsDir: string = LocalPackage.DeployDir + "/versions";

    public static PackageUpdateFileName: string = "update.zip";
    public static PackageInfoFile: string = "currentPackage.json";
    public static OldPackageInfoFile: string = "oldPackage.json";
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
    apply(applySuccess: SuccessCallback<void>, errorCallbackOrRollbackTimeout?: ErrorCallback | number, rollbackTimeout?: number): void {
        try {
            var timeout = 0;
            var applyError: ErrorCallback;
            
            /* Handle parameters */
            if (typeof rollbackTimeout === "number") {
                timeout = rollbackTimeout;
            } else if (!rollbackTimeout && typeof errorCallbackOrRollbackTimeout === "number") {
                timeout = <number>errorCallbackOrRollbackTimeout;
            }

            if (typeof errorCallbackOrRollbackTimeout === "function") {
                applyError = <ErrorCallback>errorCallbackOrRollbackTimeout;
            }

            var newPackageLocation = LocalPackage.VersionsDir + "/" + this.packageHash;

            var writeNewPackageMetadata = (deployDir: DirectoryEntry, writeMetadataCallback: Callback<void>) => {
                NativeAppInfo.getApplicationBuildTime((buildTimeError: Error, timestamp: string) => {
                    NativeAppInfo.getApplicationVersion((appVersionError: Error, appVersion: string) => {
                        buildTimeError && console.log("Could not get application build time. " + buildTimeError);
                        appVersionError && console.log("Could not get application version." + appVersionError);

                        var currentPackageMetadata: IPackageInfoMetadata = {
                            nativeBuildTime: timestamp,
                            localPath: deployDir.fullPath,
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
                LocalPackage.getCurrentOrDefaultPackage((oldPackage: LocalPackage) => {
                    LocalPackage.writeOldPackageInformation((backupError: Error) => {
                        backupError && console.log("Package information was not backed up. " + CallbackUtil.getErrorMessage(backupError));
                        /* continue on error, current package information might be missing if this is the fist update */
                        writeNewPackageMetadata(deployDir, (writeMetadataError: Error) => {
                            if (writeMetadataError) {
                                applyError && applyError(writeMetadataError);
                            } else {
                                var silentCleanup = (cleanCallback: Callback<void>) => {
                                    deleteDirectory(LocalPackage.DownloadDir, (e1: Error) => {
                                        cleanOldPackage(oldPackage, (e2: Error) => {
                                            cleanCallback(e1 || e2, null);
                                        });
                                    });
                                };

                                var invokeSuccessAndApply = () => {
                                    applySuccess && applySuccess();
                                    /* no neeed for callbacks, the javascript context will reload */
                                    cordova.exec(() => { }, () => { }, "CodePush", "apply", [deployDir.fullPath, timeout.toString()]);
                                };

                                var preApplySuccess = () => {
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

                                var preApplyFailure = (applyError?: any) => {
                                    var error = new Error("An error has ocurred while applying the package. " + CallbackUtil.getErrorMessage(applyError));
                                    applyError && applyError(error);
                                };

                                cordova.exec(preApplySuccess, preApplyFailure, "CodePush", "preApply", [deployDir.fullPath]);
                            }
                        });
                    });
                }, applyError);
            };

            var handleCleanDeployment = (cleanDeployCallback: Callback<void>) => {
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
                                    cleanDeployCallback(null, null);
                                }
                            });
                        }
                    });
                });
            };
            var copyCurrentPackage = (copyCallback: Callback<void>) => {
                FileUtil.getDataDirectory(newPackageLocation, true, (deployDirError: Error, deployDir: DirectoryEntry) => {
                    LocalPackage.getPackage(LocalPackage.PackageInfoFile, (currentPackage: LocalPackage) => {
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
                    applyError && applyError(new Error("Could not unzip package. " + CallbackUtil.getErrorMessage(unzipError)));
                } else {
                    FileUtil.getDataDirectory(newPackageLocation, true, (deployDirError: Error, deployDir: DirectoryEntry) => {
                        // check for diff manifest
                        FileUtil.getDataFile(LocalPackage.DownloadUnzipDir, LocalPackage.DiffManifestFile, false, (manifestError: Error, diffManifest: FileEntry) => {
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
            applyError && applyError(new Error("An error ocurred while applying the package. " + CallbackUtil.getErrorMessage(e)));
        }
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
    public static writeOldPackageInformation(callback: Callback<void>): void {
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
            packageError && packageError(new Error("Cannot read package information. " + CallbackUtil.getErrorMessage(e)));
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
            NativeAppInfo.applyFailed(metadata.packageHash, (applyFailed: boolean) => {
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
                    console.log("Could not get application version." + appVersionError);
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

 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 ALSO, PLEASE DO NOT SUBMIT PULL REQUESTS WITH CHANGES TO THIS FILE. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.MD. 
 *********************************************************************************************/ 


/// <reference path="../typings/codePush.d.ts" />
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Package = require("./package");
var NativeAppInfo = require("./nativeAppInfo");
var FileUtil = require("./fileUtil");
var CallbackUtil = require("./callbackUtil");
var LocalPackage = (function (_super) {
    __extends(LocalPackage, _super);
    function LocalPackage() {
        _super.apply(this, arguments);
    }
    LocalPackage.prototype.apply = function (applySuccess, errorCallbackOrRollbackTimeout, rollbackTimeout) {
        var _this = this;
        try {
            var timeout = 0;
            var applyError;
            if (typeof rollbackTimeout === "number") {
                timeout = rollbackTimeout;
            }
            else if (!rollbackTimeout && typeof errorCallbackOrRollbackTimeout === "number") {
                timeout = errorCallbackOrRollbackTimeout;
            }
            if (typeof errorCallbackOrRollbackTimeout === "function") {
                applyError = errorCallbackOrRollbackTimeout;
            }
            var newPackageLocation = LocalPackage.VersionsDir + "/" + this.packageHash;
            var writeNewPackageMetadata = function (deployDir, writeMetadataCallback) {
                NativeAppInfo.getApplicationBuildTime(function (buildTimeError, timestamp) {
                    NativeAppInfo.getApplicationVersion(function (appVersionError, appVersion) {
                        buildTimeError && console.log("Could not get application build time. " + buildTimeError);
                        appVersionError && console.log("Could not get application version." + appVersionError);
                        var currentPackageMetadata = {
                            nativeBuildTime: timestamp,
                            localPath: deployDir.fullPath,
                            appVersion: appVersion,
                            deploymentKey: _this.deploymentKey,
                            description: _this.description,
                            isMandatory: _this.isMandatory,
                            packageSize: _this.packageSize,
                            label: _this.label,
                            packageHash: _this.packageHash,
                            isFirstRun: false,
                            failedApply: false,
                            apply: undefined
                        };
                        LocalPackage.writeCurrentPackageInformation(currentPackageMetadata, writeMetadataCallback);
                    });
                });
            };
            var deleteDirectory = function (dirLocation, deleteDirCallback) {
                FileUtil.getDataDirectory(dirLocation, false, function (oldDirError, dirToDelete) {
                    if (oldDirError) {
                        deleteDirCallback(oldDirError, null);
                    }
                    else {
                        var win = function () { deleteDirCallback(null, null); };
                        var fail = function (e) { deleteDirCallback(FileUtil.fileErrorToError(e), null); };
                        dirToDelete.removeRecursively(win, fail);
                    }
                });
            };
            var cleanOldPackage = function (oldPackage, cleanPackageCallback) {
                if (oldPackage && oldPackage.localPath) {
                    deleteDirectory(oldPackage.localPath, cleanPackageCallback);
                }
                else {
                    cleanPackageCallback(new Error("The package could not be found."), null);
                }
            };
            var donePackageFileCopy = function (deployDir) {
                LocalPackage.getCurrentOrDefaultPackage(function (oldPackage) {
                    LocalPackage.writeOldPackageInformation(function (backupError) {
                        backupError && console.log("Package information was not backed up. " + CallbackUtil.getErrorMessage(backupError));
                        writeNewPackageMetadata(deployDir, function (writeMetadataError) {
                            if (writeMetadataError) {
                                applyError && applyError(writeMetadataError);
                            }
                            else {
                                var silentCleanup = function (cleanCallback) {
                                    deleteDirectory(LocalPackage.DownloadDir, function (e1) {
                                        cleanOldPackage(oldPackage, function (e2) {
                                            cleanCallback(e1 || e2, null);
                                        });
                                    });
                                };
                                var invokeSuccessAndApply = function () {
                                    applySuccess && applySuccess();
                                    cordova.exec(function () { }, function () { }, "CodePush", "apply", [deployDir.fullPath, timeout.toString()]);
                                };
                                var preApplySuccess = function () {
                                    if (timeout > 0) {
                                        invokeSuccessAndApply();
                                    }
                                    else {
                                        silentCleanup(function (cleanupError) {
                                            invokeSuccessAndApply();
                                        });
                                    }
                                };
                                var preApplyFailure = function (applyError) {
                                    var error = new Error("An error has ocurred while applying the package. " + CallbackUtil.getErrorMessage(applyError));
                                    applyError && applyError(error);
                                };
                                cordova.exec(preApplySuccess, preApplyFailure, "CodePush", "preApply", [deployDir.fullPath]);
                            }
                        });
                    });
                }, applyError);
            };
            var handleCleanDeployment = function (cleanDeployCallback) {
                FileUtil.getDataDirectory(newPackageLocation, true, function (deployDirError, deployDir) {
                    FileUtil.getDataDirectory(LocalPackage.DownloadUnzipDir, false, function (unzipDirErr, unzipDir) {
                        if (unzipDirErr || deployDirError) {
                            cleanDeployCallback(new Error("Could not copy new package."), null);
                        }
                        else {
                            FileUtil.copyDirectoryEntriesTo(unzipDir, deployDir, function (copyError) {
                                if (copyError) {
                                    cleanDeployCallback(copyError, null);
                                }
                                else {
                                    cleanDeployCallback(null, null);
                                }
                            });
                        }
                    });
                });
            };
            var copyCurrentPackage = function (copyCallback) {
                FileUtil.getDataDirectory(newPackageLocation, true, function (deployDirError, deployDir) {
                    LocalPackage.getPackage(LocalPackage.PackageInfoFile, function (currentPackage) {
                        if (deployDirError) {
                            applyError && applyError(new Error("Could not acquire the source/destination folders. "));
                        }
                        else {
                            var success = function (currentPackageDirectory) {
                                FileUtil.copyDirectoryEntriesTo(currentPackageDirectory, deployDir, copyCallback);
                            };
                            var fail = function (fileSystemError) {
                                copyCallback(FileUtil.fileErrorToError(fileSystemError), null);
                            };
                            window.resolveLocalFileSystemURL(currentPackage.localPath, success, fail);
                        }
                    }, applyError);
                });
            };
            var handleDiffDeployment = function (diffManifest) {
                copyCurrentPackage(function (currentPackageError) {
                    handleCleanDeployment(function (cleanDeployError) {
                        var diffContent = FileUtil.readFileEntry(diffManifest, function (error, content) {
                            if (error || currentPackageError || cleanDeployError) {
                                applyError && applyError(new Error("Cannot perform diff-update."));
                            }
                            else {
                                var manifest = JSON.parse(content);
                                FileUtil.deleteEntriesFromDataDirectory(newPackageLocation, manifest.deletedFiles, function (deleteError) {
                                    FileUtil.getDataDirectory(newPackageLocation, true, function (deployDirError, deployDir) {
                                        if (deleteError || deployDirError) {
                                            applyError && applyError(new Error("Cannot clean up deleted manifest files."));
                                        }
                                        else {
                                            donePackageFileCopy(deployDir);
                                        }
                                    });
                                });
                            }
                        });
                    });
                });
            };
            var newPackageUnzipped = function (unzipError) {
                if (unzipError) {
                    applyError && applyError(new Error("Could not unzip package. " + CallbackUtil.getErrorMessage(unzipError)));
                }
                else {
                    FileUtil.getDataDirectory(newPackageLocation, true, function (deployDirError, deployDir) {
                        FileUtil.getDataFile(LocalPackage.DownloadUnzipDir, LocalPackage.DiffManifestFile, false, function (manifestError, diffManifest) {
                            if (!manifestError && !!diffManifest) {
                                handleDiffDeployment(diffManifest);
                            }
                            else {
                                handleCleanDeployment(function () {
                                    donePackageFileCopy(deployDir);
                                });
                            }
                        });
                    });
                }
            };
            FileUtil.getDataDirectory(LocalPackage.DownloadUnzipDir, false, function (error, directoryEntry) {
                var unzipPackage = function () {
                    FileUtil.getDataDirectory(LocalPackage.DownloadUnzipDir, true, function (innerError, unzipDir) {
                        if (innerError) {
                            applyError && applyError(innerError);
                        }
                        else {
                            zip.unzip(_this.localPath, unzipDir.toInternalURL(), newPackageUnzipped);
                        }
                    });
                };
                if (!error && !!directoryEntry) {
                    directoryEntry.removeRecursively(function () {
                        unzipPackage();
                    }, function (cleanupError) {
                        applyError && applyError(FileUtil.fileErrorToError(cleanupError));
                    });
                }
                else {
                    unzipPackage();
                }
            });
        }
        catch (e) {
            applyError && applyError(new Error("An error ocurred while applying the package. " + CallbackUtil.getErrorMessage(e)));
        }
    };
    LocalPackage.writeCurrentPackageInformation = function (packageInfoMetadata, callback) {
        var content = JSON.stringify(packageInfoMetadata);
        FileUtil.writeStringToDataFile(content, LocalPackage.RootDir, LocalPackage.PackageInfoFile, true, callback);
    };
    LocalPackage.writeOldPackageInformation = function (callback) {
        var reportFileError = function (error) {
            callback(FileUtil.fileErrorToError(error), null);
        };
        var copyFile = function (fileToCopy) {
            fileToCopy.getParent(function (parent) {
                fileToCopy.copyTo(parent, LocalPackage.OldPackageInfoFile, function () {
                    callback(null, null);
                }, reportFileError);
            }, reportFileError);
        };
        var gotFile = function (error, currentPackageFile) {
            if (error) {
                callback(error, null);
            }
            else {
                FileUtil.getDataFile(LocalPackage.RootDir, LocalPackage.OldPackageInfoFile, false, function (error, oldPackageFile) {
                    if (!error && !!oldPackageFile) {
                        oldPackageFile.remove(function () {
                            copyFile(currentPackageFile);
                        }, reportFileError);
                    }
                    else {
                        copyFile(currentPackageFile);
                    }
                });
            }
        };
        FileUtil.getDataFile(LocalPackage.RootDir, LocalPackage.PackageInfoFile, false, gotFile);
    };
    LocalPackage.getOldPackage = function (packageSuccess, packageError) {
        return LocalPackage.getPackage(LocalPackage.OldPackageInfoFile, packageSuccess, packageError);
    };
    LocalPackage.getPackage = function (packageFile, packageSuccess, packageError) {
        var handleError = function (e) {
            packageError && packageError(new Error("Cannot read package information. " + CallbackUtil.getErrorMessage(e)));
        };
        try {
            FileUtil.readDataFile(LocalPackage.RootDir, packageFile, function (error, content) {
                if (error) {
                    handleError(error);
                }
                else {
                    try {
                        var packageInfo = JSON.parse(content);
                        LocalPackage.getLocalPackageFromMetadata(packageInfo, packageSuccess, packageError);
                    }
                    catch (e) {
                        handleError(e);
                    }
                }
            });
        }
        catch (e) {
            handleError(e);
        }
    };
    LocalPackage.getLocalPackageFromMetadata = function (metadata, packageSuccess, packageError) {
        if (!metadata) {
            packageError && packageError(new Error("Invalid package metadata."));
        }
        else {
            NativeAppInfo.applyFailed(metadata.packageHash, function (applyFailed) {
                NativeAppInfo.isFirstRun(metadata.packageHash, function (isFirstRun) {
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
    };
    LocalPackage.getCurrentOrDefaultPackage = function (packageSuccess, packageError) {
        LocalPackage.getPackageInfoOrDefault(LocalPackage.PackageInfoFile, packageSuccess, packageError);
    };
    LocalPackage.getOldOrDefaultPackage = function (packageSuccess, packageError) {
        LocalPackage.getPackageInfoOrDefault(LocalPackage.OldPackageInfoFile, packageSuccess, packageError);
    };
    LocalPackage.getPackageInfoOrDefault = function (packageFile, packageSuccess, packageError) {
        var packageFailure = function (error) {
            NativeAppInfo.getApplicationVersion(function (appVersionError, appVersion) {
                if (appVersionError) {
                    console.log("Could not get application version." + appVersionError);
                    packageError(appVersionError);
                }
                else {
                    var defaultPackage = new LocalPackage();
                    defaultPackage.appVersion = appVersion;
                    packageSuccess(defaultPackage);
                }
            });
        };
        LocalPackage.getPackage(packageFile, packageSuccess, packageFailure);
    };
    LocalPackage.getPackageInfoOrNull = function (packageFile, packageSuccess, packageError) {
        LocalPackage.getPackage(packageFile, packageSuccess, packageSuccess.bind(null, null));
    };
    LocalPackage.RootDir = "codepush";
    LocalPackage.DownloadDir = LocalPackage.RootDir + "/download";
    LocalPackage.DownloadUnzipDir = LocalPackage.DownloadDir + "/unzipped";
    LocalPackage.DeployDir = LocalPackage.RootDir + "/deploy";
    LocalPackage.VersionsDir = LocalPackage.DeployDir + "/versions";
    LocalPackage.PackageUpdateFileName = "update.zip";
    LocalPackage.PackageInfoFile = "currentPackage.json";
    LocalPackage.OldPackageInfoFile = "oldPackage.json";
    LocalPackage.DiffManifestFile = "hotcodepush.json";
    return LocalPackage;
})(Package);
module.exports = LocalPackage;

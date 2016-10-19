
 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE DIRECTLY AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER, AND THEN RUN GULP. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.md. 
 *********************************************************************************************/ 


"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var Package = require("./package");
var NativeAppInfo = require("./nativeAppInfo");
var FileUtil = require("./fileUtil");
var CodePushUtil = require("./codePushUtil");
var Sdk = require("./sdk");
var LocalPackage = (function (_super) {
    __extends(LocalPackage, _super);
    function LocalPackage() {
        _super.apply(this, arguments);
    }
    LocalPackage.prototype.install = function (installSuccess, errorCallback, installOptions) {
        var _this = this;
        try {
            CodePushUtil.logMessage("Installing update");
            if (!installOptions) {
                installOptions = LocalPackage.getDefaultInstallOptions();
            }
            else {
                CodePushUtil.copyUnassignedMembers(LocalPackage.getDefaultInstallOptions(), installOptions);
            }
            var installError = function (error) {
                CodePushUtil.invokeErrorCallback(error, errorCallback);
                Sdk.reportStatusDeploy(_this, AcquisitionStatus.DeploymentFailed, _this.deploymentKey);
            };
            var newPackageLocation = LocalPackage.VersionsDir + "/" + this.packageHash;
            var donePackageFileCopy = function (deployDir) {
                _this.localPath = deployDir.fullPath;
                _this.finishInstall(deployDir, installOptions, installSuccess, installError);
            };
            var newPackageUnzipped = function (unzipError) {
                if (unzipError) {
                    installError && installError(new Error("Could not unzip package. " + CodePushUtil.getErrorMessage(unzipError)));
                }
                else {
                    LocalPackage.handleDeployment(newPackageLocation, CodePushUtil.getNodeStyleCallbackFor(donePackageFileCopy, installError));
                }
            };
            FileUtil.getDataDirectory(LocalPackage.DownloadUnzipDir, false, function (error, directoryEntry) {
                var unzipPackage = function () {
                    FileUtil.getDataDirectory(LocalPackage.DownloadUnzipDir, true, function (innerError, unzipDir) {
                        if (innerError) {
                            installError && installError(innerError);
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
                        installError && installError(FileUtil.fileErrorToError(cleanupError));
                    });
                }
                else {
                    unzipPackage();
                }
            });
        }
        catch (e) {
            installError && installError(new Error("An error occured while installing the package. " + CodePushUtil.getErrorMessage(e)));
        }
    };
    LocalPackage.prototype.finishInstall = function (deployDir, installOptions, installSuccess, installError) {
        var _this = this;
        function backupPackageInformationFileIfNeeded(backupIfNeededDone) {
            NativeAppInfo.isPendingUpdate(function (pendingUpdate) {
                if (pendingUpdate) {
                    backupIfNeededDone(null, null);
                }
                else {
                    LocalPackage.backupPackageInformationFile(backupIfNeededDone);
                }
            });
        }
        LocalPackage.getCurrentOrDefaultPackage(function (oldPackage) {
            backupPackageInformationFileIfNeeded(function (backupError) {
                _this.writeNewPackageMetadata(deployDir, function (writeMetadataError) {
                    if (writeMetadataError) {
                        installError && installError(writeMetadataError);
                    }
                    else {
                        var invokeSuccessAndInstall = function () {
                            CodePushUtil.logMessage("Install succeeded.");
                            var installModeToUse = _this.isMandatory ? installOptions.mandatoryInstallMode : installOptions.installMode;
                            if (installModeToUse === InstallMode.IMMEDIATE) {
                                installSuccess && installSuccess(installModeToUse);
                                cordova.exec(function () { }, function () { }, "CodePush", "install", [deployDir.fullPath,
                                    installModeToUse.toString(), installOptions.minimumBackgroundDuration.toString()]);
                            }
                            else {
                                cordova.exec(function () { installSuccess && installSuccess(installModeToUse); }, function () { installError && installError(); }, "CodePush", "install", [deployDir.fullPath,
                                    installModeToUse.toString(), installOptions.minimumBackgroundDuration.toString()]);
                            }
                        };
                        var preInstallSuccess = function () {
                            invokeSuccessAndInstall();
                        };
                        var preInstallFailure = function (preInstallError) {
                            CodePushUtil.logError("Preinstall failure.", preInstallError);
                            var error = new Error("An error has occured while installing the package. " + CodePushUtil.getErrorMessage(preInstallError));
                            installError && installError(error);
                        };
                        cordova.exec(preInstallSuccess, preInstallFailure, "CodePush", "preInstall", [deployDir.fullPath]);
                    }
                });
            });
        }, installError);
    };
    LocalPackage.handleDeployment = function (newPackageLocation, deployCallback) {
        FileUtil.getDataDirectory(newPackageLocation, true, function (deployDirError, deployDir) {
            FileUtil.getDataFile(LocalPackage.DownloadUnzipDir, LocalPackage.DiffManifestFile, false, function (manifestError, diffManifest) {
                if (!manifestError && !!diffManifest) {
                    LocalPackage.handleDiffDeployment(newPackageLocation, diffManifest, deployCallback);
                }
                else {
                    LocalPackage.handleCleanDeployment(newPackageLocation, function (error) {
                        deployCallback(error, deployDir);
                    });
                }
            });
        });
    };
    LocalPackage.prototype.writeNewPackageMetadata = function (deployDir, writeMetadataCallback) {
        var _this = this;
        NativeAppInfo.getApplicationBuildTime(function (buildTimeError, timestamp) {
            NativeAppInfo.getApplicationVersion(function (appVersionError, appVersion) {
                buildTimeError && CodePushUtil.logError("Could not get application build time. " + buildTimeError);
                appVersionError && CodePushUtil.logError("Could not get application version." + appVersionError);
                var currentPackageMetadata = {
                    nativeBuildTime: timestamp,
                    localPath: _this.localPath,
                    appVersion: appVersion,
                    deploymentKey: _this.deploymentKey,
                    description: _this.description,
                    isMandatory: _this.isMandatory,
                    packageSize: _this.packageSize,
                    label: _this.label,
                    packageHash: _this.packageHash,
                    isFirstRun: false,
                    failedInstall: false,
                    install: undefined
                };
                LocalPackage.writeCurrentPackageInformation(currentPackageMetadata, writeMetadataCallback);
            });
        });
    };
    LocalPackage.handleCleanDeployment = function (newPackageLocation, cleanDeployCallback) {
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
                            cleanDeployCallback(null, deployDir);
                        }
                    });
                }
            });
        });
    };
    LocalPackage.copyCurrentPackage = function (newPackageLocation, copyCallback) {
        var handleError = function (e) {
            copyCallback && copyCallback(e, null);
        };
        var doCopy = function (currentPackagePath) {
            var getCurrentPackageDirectory;
            if (currentPackagePath) {
                getCurrentPackageDirectory = function (getCurrentPackageDirectoryCallback) {
                    FileUtil.getDataDirectory(currentPackagePath, false, getCurrentPackageDirectoryCallback);
                };
            }
            else {
                newPackageLocation = newPackageLocation + "/www";
                getCurrentPackageDirectory = function (getCurrentPackageDirectoryCallback) {
                    FileUtil.getApplicationDirectory("www", getCurrentPackageDirectoryCallback);
                };
            }
            FileUtil.getDataDirectory(newPackageLocation, true, function (deployDirError, deployDir) {
                if (deployDirError) {
                    handleError(new Error("Could not acquire the source/destination folders. "));
                }
                else {
                    var success = function (currentPackageDirectory) {
                        FileUtil.copyDirectoryEntriesTo(currentPackageDirectory, deployDir, copyCallback);
                    };
                    var fail = function (fileSystemError) {
                        copyCallback && copyCallback(FileUtil.fileErrorToError(fileSystemError), null);
                    };
                    getCurrentPackageDirectory(CodePushUtil.getNodeStyleCallbackFor(success, fail));
                }
            });
        };
        var packageFailure = function (error) {
            doCopy();
        };
        var packageSuccess = function (currentPackage) {
            doCopy(currentPackage.localPath);
        };
        LocalPackage.getPackage(LocalPackage.PackageInfoFile, packageSuccess, packageFailure);
    };
    LocalPackage.handleDiffDeployment = function (newPackageLocation, diffManifest, diffCallback) {
        var handleError = function (e) {
            diffCallback(e, null);
        };
        LocalPackage.copyCurrentPackage(newPackageLocation, function (currentPackageError) {
            LocalPackage.handleCleanDeployment(newPackageLocation, function (cleanDeployError) {
                FileUtil.readFileEntry(diffManifest, function (error, content) {
                    if (error || currentPackageError || cleanDeployError) {
                        handleError(new Error("Cannot perform diff-update."));
                    }
                    else {
                        var manifest = JSON.parse(content);
                        FileUtil.deleteEntriesFromDataDirectory(newPackageLocation, manifest.deletedFiles, function (deleteError) {
                            FileUtil.getDataDirectory(newPackageLocation, true, function (deployDirError, deployDir) {
                                if (deleteError || deployDirError) {
                                    handleError(new Error("Cannot clean up deleted manifest files."));
                                }
                                else {
                                    diffCallback(null, deployDir);
                                }
                            });
                        });
                    }
                });
            });
        });
    };
    LocalPackage.writeCurrentPackageInformation = function (packageInfoMetadata, callback) {
        var content = JSON.stringify(packageInfoMetadata);
        FileUtil.writeStringToDataFile(content, LocalPackage.RootDir, LocalPackage.PackageInfoFile, true, callback);
    };
    LocalPackage.backupPackageInformationFile = function (callback) {
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
            packageError && packageError(new Error("Cannot read package information. " + CodePushUtil.getErrorMessage(e)));
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
            NativeAppInfo.isFailedUpdate(metadata.packageHash, function (installFailed) {
                NativeAppInfo.isFirstRun(metadata.packageHash, function (isFirstRun) {
                    var localPackage = new LocalPackage();
                    localPackage.appVersion = metadata.appVersion;
                    localPackage.deploymentKey = metadata.deploymentKey;
                    localPackage.description = metadata.description;
                    localPackage.failedInstall = installFailed;
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
                    CodePushUtil.logError("Could not get application version." + appVersionError);
                    packageError(appVersionError);
                    return;
                }
                NativeAppInfo.getBinaryHash(function (binaryHashError, binaryHash) {
                    var defaultPackage = new LocalPackage();
                    defaultPackage.appVersion = appVersion;
                    if (binaryHashError) {
                        CodePushUtil.logError("Could not get binary hash." + binaryHashError);
                    }
                    else {
                        defaultPackage.packageHash = binaryHash;
                    }
                    packageSuccess(defaultPackage);
                });
            });
        };
        LocalPackage.getPackage(packageFile, packageSuccess, packageFailure);
    };
    LocalPackage.getPackageInfoOrNull = function (packageFile, packageSuccess, packageError) {
        LocalPackage.getPackage(packageFile, packageSuccess, packageSuccess.bind(null, null));
    };
    LocalPackage.getDefaultInstallOptions = function () {
        if (!LocalPackage.DefaultInstallOptions) {
            LocalPackage.DefaultInstallOptions = {
                installMode: InstallMode.ON_NEXT_RESTART,
                minimumBackgroundDuration: 0,
                mandatoryInstallMode: InstallMode.IMMEDIATE
            };
        }
        return LocalPackage.DefaultInstallOptions;
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
}(Package));
module.exports = LocalPackage;

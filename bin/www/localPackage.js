
 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE DIRECTLY AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER, AND THEN RUN GULP. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.md. 
 *********************************************************************************************/ 


"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var Package = require("./package");
var NativeAppInfo = require("./nativeAppInfo");
var FileUtil = require("./fileUtil");
var CodePushUtil = require("./codePushUtil");
var Sdk = require("./sdk");
var LocalPackage = (function (_super) {
    __extends(LocalPackage, _super);
    function LocalPackage() {
        return _super !== null && _super.apply(this, arguments) || this;
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
            var newPackageUnzipped = function (unzipError) {
                if (unzipError) {
                    installError && installError(new Error("Could not unzip package" + CodePushUtil.getErrorMessage(unzipError)));
                }
                else {
                    LocalPackage.handleDeployment(newPackageLocation, CodePushUtil.getNodeStyleCallbackFor(donePackageFileCopy, installError));
                }
            };
            var donePackageFileCopy = function (deploymentResult) {
                _this.verifyPackage(deploymentResult, installError, function () {
                    packageVerified(deploymentResult.deployDir);
                });
            };
            var packageVerified = function (deployDir) {
                _this.localPath = deployDir.fullPath;
                _this.finishInstall(deployDir, installOptions, installSuccess, installError);
            };
            FileUtil.getDataDirectory(LocalPackage.DownloadUnzipDir, false, function (error, directoryEntry) {
                var unzipPackage = function () {
                    FileUtil.getDataDirectory(LocalPackage.DownloadUnzipDir, true, function (innerError, unzipDir) {
                        if (innerError) {
                            installError && installError(innerError);
                            return;
                        }
                        zip.unzip(_this.localPath, unzipDir.toInternalURL(), newPackageUnzipped);
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
    LocalPackage.prototype.verifyPackage = function (deploymentResult, installError, successCallback) {
        var _this = this;
        var deployDir = deploymentResult.deployDir;
        var verificationFail = function (error) {
            installError && installError(error);
        };
        var verify = function (isSignatureVerificationEnabled, isSignatureAppearedInBundle, publicKey, signature) {
            if (isSignatureVerificationEnabled) {
                if (isSignatureAppearedInBundle) {
                    _this.verifyHash(deployDir, _this.packageHash, verificationFail, function () {
                        _this.verifySignature(deployDir, _this.packageHash, publicKey, signature, verificationFail, successCallback);
                    });
                }
                else {
                    var errorMessage = "Error! Public key was provided but there is no JWT signature within app bundle to verify. " +
                        "Possible reasons, why that might happen: \n" +
                        "1. You've been released CodePush bundle update using version of CodePush CLI that is not support code signing.\n" +
                        "2. You've been released CodePush bundle update without providing --privateKeyPath option.";
                    installError && installError(new Error(errorMessage));
                }
            }
            else {
                if (isSignatureAppearedInBundle) {
                    CodePushUtil.logMessage("Warning! JWT signature exists in codepush update but code integrity check couldn't be performed because there is no public key configured. " +
                        "Please ensure that public key is properly configured within your application.");
                    _this.verifyHash(deployDir, _this.packageHash, verificationFail, successCallback);
                }
                else {
                    if (deploymentResult.isDiffUpdate) {
                        _this.verifyHash(deployDir, _this.packageHash, verificationFail, successCallback);
                    }
                    else {
                        successCallback();
                    }
                }
            }
        };
        if (deploymentResult.isDiffUpdate) {
            CodePushUtil.logMessage("Applying diff update");
        }
        else {
            CodePushUtil.logMessage("Applying full update");
        }
        var isSignatureVerificationEnabled, isSignatureAppearedInBundle;
        var publicKey;
        this.getPublicKey(function (error, publicKeyResult) {
            if (error) {
                installError && installError(new Error("Error reading public key. " + error));
                return;
            }
            publicKey = publicKeyResult;
            isSignatureVerificationEnabled = (publicKey !== null);
            _this.getSignatureFromUpdate(deploymentResult.deployDir, function (error, signature) {
                if (error) {
                    installError && installError(new Error("Error reading signature from update. " + error));
                    return;
                }
                isSignatureAppearedInBundle = (signature !== null);
                verify(isSignatureVerificationEnabled, isSignatureAppearedInBundle, publicKey, signature);
            });
        });
    };
    LocalPackage.prototype.getPublicKey = function (callback) {
        var success = function (publicKey) {
            callback(null, publicKey);
        };
        var fail = function (error) {
            callback(error, null);
        };
        cordova.exec(success, fail, "CodePush", "getPublicKey", []);
    };
    LocalPackage.prototype.getSignatureFromUpdate = function (deployDir, callback) {
        var rootUri = cordova.file.dataDirectory;
        var path = deployDir.fullPath + "/www";
        var fileName = ".codepushrelease";
        FileUtil.fileExists(rootUri, path, fileName, function (error, result) {
            if (!result) {
                callback(null, null);
                return;
            }
            FileUtil.readFile(rootUri, path, fileName, function (error, signature) {
                if (error) {
                    callback(error, null);
                    return;
                }
                callback(null, signature);
            });
        });
    };
    LocalPackage.prototype.verifyHash = function (deployDir, newUpdateHash, errorCallback, successCallback) {
        var packageHashSuccess = function (computedHash) {
            if (computedHash !== newUpdateHash) {
                errorCallback(new Error("The update contents failed the data integrity check."));
                return;
            }
            CodePushUtil.logMessage("The update contents succeeded the data integrity check.");
            successCallback();
        };
        var packageHashFail = function (error) {
            errorCallback(new Error("Unable to compute hash for package: " + error));
        };
        CodePushUtil.logMessage("Verifying hash for folder path: " + deployDir.fullPath);
        cordova.exec(packageHashSuccess, packageHashFail, "CodePush", "getPackageHash", [deployDir.fullPath]);
    };
    LocalPackage.prototype.verifySignature = function (deployDir, newUpdateHash, publicKey, signature, errorCallback, successCallback) {
        var decodeSignatureSuccess = function (contentHash) {
            if (contentHash !== newUpdateHash) {
                errorCallback(new Error("The update contents failed the code signing check."));
                return;
            }
            CodePushUtil.logMessage("The update contents succeeded the code signing check.");
            successCallback();
        };
        var decodeSignatureFail = function (error) {
            errorCallback(new Error("Unable to verify signature for package: " + error));
        };
        CodePushUtil.logMessage("Verifying signature for folder path: " + deployDir.fullPath);
        cordova.exec(decodeSignatureSuccess, decodeSignatureFail, "CodePush", "decodeSignature", [publicKey, signature]);
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
                        deployCallback(error, { deployDir: deployDir, isDiffUpdate: false });
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
                    FileUtil.copyDirectoryEntriesTo(unzipDir, deployDir, [], function (copyError) {
                        if (copyError) {
                            cleanDeployCallback(copyError, null);
                        }
                        else {
                            cleanDeployCallback(null, { deployDir: deployDir, isDiffUpdate: false });
                        }
                    });
                }
            });
        });
    };
    LocalPackage.copyCurrentPackage = function (newPackageLocation, ignoreList, copyCallback) {
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
                        FileUtil.copyDirectoryEntriesTo(currentPackageDirectory, deployDir, ignoreList, copyCallback);
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
        LocalPackage.copyCurrentPackage(newPackageLocation, [".codepushrelease"], function (currentPackageError) {
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
                                    diffCallback(null, { deployDir: deployDir, isDiffUpdate: true });
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
                    localPackage.isMandatory = metadata.isMandatory;
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

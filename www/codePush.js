/**
 *******************************************************
 *                                                     *
 *   Copyright (C) Microsoft. All rights reserved.     *
 *                                                     *
 *******************************************************
 */
/// <reference path="./typings/codePush.d.ts" />
/// <reference path="./typings/fileSystem.d.ts" />
/// <reference path="./typings/fileTransfer.d.ts" />
/// <reference path="httpRequester.ts" />
/// <reference path="fileUtil.ts" />
/// <reference path="nativeAppInfo.ts" />
"use strict";
var CodePushFileUtil = require("./fileUtil");
var CodePushHttpRequester = require("./httpRequester");
var NativeAppInfo = require("./nativeAppInfo");
/**
 * This is the entry point to Cordova Code Push SDK.
 * It provides the following features to the app developer:
 * - polling the server for new versions of the app
 * - downloading new versions locally
 * - unpacking and applying the update
 * - launching the child app
 */
var CodePush = (function () {
    function CodePush(ignoreAppVersion) {
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
    CodePush.prototype.updateSuccess = function (notifySucceeded, notifyFailed) {
        cordova.exec(notifySucceeded, notifyFailed, "CodePush", "updatesuccess", []);
    };
    /**
     * Checks if a package update was previously attempted but failed for a given package hash.
     * Every reverted update attempted with applyWithRevertProtection() is stored such that the application developer has the option to ignore
     * updates that previously failed. This way, an infinite update loop can be prevented in case of a bad update package.
     *
     * @param packageHash String hash of the package update to check.
     * @param checkSucceeded Callback taking one boolean parameter invoked with the result of the check.
     * @param checkFailed Optional callback invoked in case of an error.
     */
    CodePush.prototype.updatePreviouslyFailed = function (packageHash, checkSucceeded, checkFailed) {
        var win = function (failed) {
            checkSucceeded && checkSucceeded(!!failed);
        };
        var fail = function (e) {
            checkFailed && checkFailed(e);
        };
        cordova.exec(win, fail, "CodePush", "isfailedupdate", [packageHash]);
    };
    /**
     * Get the current package information.
     *
     * @param packageSuccess Callback invoked with the currently deployed package information.
     * @param packageError Optional callback invoked in case of an error.
     */
    CodePush.prototype.getCurrentPackage = function (packageSuccess, packageError) {
        var _this = this;
        var handleError = function (e) {
            packageError && packageError(new Error("Cannot read package information. " + _this.getErrorMessage(e)));
        };
        try {
            CodePushFileUtil.readDataFile(CodePush.RootDir, CodePush.PackageInfoFile, function (error, content) {
                if (error) {
                    handleError(error);
                }
                else {
                    try {
                        var packageInfo = JSON.parse(content);
                        packageSuccess && packageSuccess(packageInfo);
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
    CodePush.prototype.getCurrentOrDefaultPackage = function (packageSuccess, packageError) {
        var currentPackageFailure = function (error) {
            NativeAppInfo.getApplicationVersion(function (appVersionError, appVersion) {
                if (appVersionError) {
                    console.log("Could not get application version." + appVersionError);
                    packageError(appVersionError);
                }
                else {
                    var defaultPackage = {
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
    };
    /**
     * Writes the given local package information to the current package information file.
     * @param packageInfoMetadata The object to serialize.
     * @param callback In case of an error, this function will be called with the error as the fist parameter.
     */
    CodePush.prototype.writeCurrentPackageInformation = function (packageInfoMetadata, callback) {
        var content = JSON.stringify(packageInfoMetadata);
        CodePushFileUtil.writeStringToDataFile(content, CodePush.RootDir, CodePush.PackageInfoFile, true, callback);
    };
    /**
     * Backs up the current package information to the old package information file.
     * This file is used for recovery in case of an update going wrong.
     * @param callback In case of an error, this function will be called with the error as the fist parameter.
     */
    CodePush.prototype.writeOldPackageInformation = function (callback) {
        var reportFileError = function (error) {
            callback(CodePushFileUtil.fileErrorToError(error), null);
        };
        var copyFile = function (fileToCopy) {
            fileToCopy.getParent(function (parent) {
                fileToCopy.copyTo(parent, CodePush.OldPackageInfoFile, function () {
                    callback(null, null);
                }, reportFileError);
            }, reportFileError);
        };
        var gotFile = function (error, currentPackageFile) {
            if (error) {
                callback(error, null);
            }
            else {
                CodePushFileUtil.getDataFile(CodePush.RootDir, CodePush.OldPackageInfoFile, false, function (error, oldPackageFile) {
                    if (!error && !!oldPackageFile) {
                        /* file already exists */
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
        CodePushFileUtil.getDataFile(CodePush.RootDir, CodePush.PackageInfoFile, false, gotFile);
    };
    /**
     * Downloads a package update from the Code Push service.
     *
     * @param package The package to download.
     * @param downloadSuccess Called with one parameter, the downloaded package information, once the download completed successfully.
     * @param downloadError Optional callback invoked in case of an error.
     */
    CodePush.prototype.download = function (remotePackage, successCallback, errorCallback) {
        var _this = this;
        try {
            if (!(remotePackage && remotePackage.downloadUrl)) {
                errorCallback && errorCallback(new Error("The provided remote package does not contain a download URL."));
            }
            else {
                this.currentFileTransfer = new FileTransfer();
                var downloadSuccess = function (fileEntry) {
                    _this.currentFileTransfer = null;
                    fileEntry.file(function (file) {
                        var localPackage = {
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
                    }, function (fileError) {
                        errorCallback && errorCallback(new Error("Could not access local package. Error code: " + fileError.code));
                    });
                };
                var downloadError = function (error) {
                    _this.currentFileTransfer = null;
                    errorCallback && errorCallback(new Error(error.body));
                };
                this.currentFileTransfer.download(remotePackage.downloadUrl, this.appDataDirectory + CodePush.DownloadDir + "/" + CodePush.PackageUpdateFileName, downloadSuccess, downloadError, true);
            }
        }
        catch (e) {
            errorCallback && errorCallback(new Error("An error ocurred while downloading the package. " + this.getErrorMessage(e)));
        }
    };
    /**
     * Aborts the current download session, previously started with download().
     *
     * @param abortSuccess Optional callback invoked if the abort operation succeeded.
     * @param abortError Optional callback invoked in case of an error.
     */
    CodePush.prototype.abortDownload = function (abortSuccess, abortError) {
        try {
            if (this.currentFileTransfer) {
                this.currentFileTransfer.abort();
                /* abort succeeded */
                abortSuccess && abortSuccess();
            }
        }
        catch (e) {
            /* abort failed */
            abortError && abortError(e);
        }
    };
    /**
     * Applies a downloaded package.
     *
     * @param applySuccess Callback invoked if the apply operation succeeded.
     * @param applyError Optional callback inovoked in case of an error.
     */
    CodePush.prototype.apply = function (newPackage, applySuccess, applyError) {
        this.applyWithRevertProtection(newPackage, 0, applySuccess, applyError);
    };
    /**
     * Applies a downloaded package with revert protection.
     * If the updateSuccess() method is not invoked in the time specified by applySuccessTimeoutMillis, the application will be reverted to its previous version.
     *
     * @param newPackage The package update to apply.
     * @param updateSuccessTimeoutMillis The milliseconds interval to wait for updateSuccess(). If in the given interval a call to updateSuccess() has not been received, the application is reverted to its previous version.
     * @param applySuccess Callback invoked if the apply operation succeeded. This is the last callback to be invoked after the javascript context is reloaded in the application by launching the updated application.
     *                     Invocation of this callback does not guarantee that the application will not be reverted, since it is invoked before the applySuccessTimeoutMillis countdown starts.
     * @param applyError Optional callback inovoked in case of an error.
     */
    CodePush.prototype.applyWithRevertProtection = function (newPackage, applySuccessTimeoutMillis, applySuccess, applyError) {
        var _this = this;
        if (!newPackage) {
            applyError && applyError(new Error("Invalid package parameter."));
            return;
        }
        try {
            var newPackageLocation = CodePush.VersionsDir + "/" + newPackage.packageHash;
            var writeNewPackageMetadata = function (deployDir, writeMetadataCallback) {
                NativeAppInfo.getApplicationBuildTime(function (buildTimeError, timestamp) {
                    NativeAppInfo.getApplicationVersion(function (appVersionError, appVersion) {
                        buildTimeError && console.log("Could not get application build time. " + buildTimeError);
                        appVersionError && console.log("Could not get application version." + appVersionError);
                        var currentPackageMetadata = {
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
                        _this.writeCurrentPackageInformation(currentPackageMetadata, writeMetadataCallback);
                    });
                });
            };
            var invokeOnApplyCallback = function (callback, oldPackage, newPackage) {
                try {
                    callback && callback(oldPackage, newPackage);
                }
                catch (e) {
                    console.log("An error has occurred during the onApply() callback.");
                }
            };
            var deleteDirectory = function (dirLocation, deleteDirCallback) {
                CodePushFileUtil.getDataDirectory(dirLocation, false, function (oldDirError, dirToDelete) {
                    if (oldDirError) {
                        deleteDirCallback(oldDirError, null);
                    }
                    else {
                        var win = function () { deleteDirCallback(null, null); };
                        var fail = function (e) { deleteDirCallback(CodePushFileUtil.fileErrorToError(e), null); };
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
                _this.getCurrentOrDefaultPackage(function (oldPackage) {
                    invokeOnApplyCallback(_this.onBeforeApply, oldPackage, newPackage);
                    _this.writeOldPackageInformation(function (backupError) {
                        backupError && console.log("Package information was not backed up. " + _this.getErrorMessage(backupError));
                        /* continue on error, current package information might be missing if this is the fist update */
                        writeNewPackageMetadata(deployDir, function (writeMetadataError) {
                            if (writeMetadataError) {
                                applyError && applyError(writeMetadataError);
                            }
                            else {
                                invokeOnApplyCallback(_this.onAfterApply, oldPackage, newPackage);
                                var silentCleanup = function (cleanCallback) {
                                    deleteDirectory(CodePush.DownloadDir, function (e1) {
                                        cleanOldPackage(oldPackage, function (e2) {
                                            cleanCallback(e1 || e2, null);
                                        });
                                    });
                                };
                                var invokeSuccessAndApply = function () {
                                    applySuccess && applySuccess();
                                    /* no neeed for callbacks, the javascript context will reload */
                                    cordova.exec(function () { }, function () { }, "CodePush", "apply", [deployDir.fullPath, applySuccessTimeoutMillis.toString()]);
                                };
                                var preApplySuccess = function () {
                                    if (applySuccessTimeoutMillis > 0) {
                                        /* package will be cleaned up after success, on the native side */
                                        invokeSuccessAndApply();
                                    }
                                    else {
                                        /* clean up the package, then invoke apply */
                                        silentCleanup(function (cleanupError) {
                                            invokeSuccessAndApply();
                                        });
                                    }
                                };
                                var preApplyFailure = function (applyError) {
                                    var error = new Error("An error has ocurred while applying the package. " + _this.getErrorMessage(applyError));
                                    applyError && applyError(error);
                                };
                                cordova.exec(preApplySuccess, preApplyFailure, "CodePush", "preapply", [deployDir.fullPath]);
                            }
                        });
                    });
                }, applyError);
            };
            var handleCleanDeployment = function (cleanDeployCallback) {
                // no diff manifest
                CodePushFileUtil.getDataDirectory(newPackageLocation, true, function (deployDirError, deployDir) {
                    CodePushFileUtil.getDataDirectory(CodePush.DownloadUnzipDir, false, function (unzipDirErr, unzipDir) {
                        if (unzipDirErr || deployDirError) {
                            cleanDeployCallback(new Error("Could not copy new package."), null);
                        }
                        else {
                            CodePushFileUtil.copyDirectoryEntriesTo(unzipDir, deployDir, function (copyError) {
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
                CodePushFileUtil.getDataDirectory(newPackageLocation, true, function (deployDirError, deployDir) {
                    _this.getCurrentPackage(function (currentPackage) {
                        if (deployDirError) {
                            applyError && applyError(new Error("Could not acquire the source/destination folders. "));
                        }
                        else {
                            var success = function (currentPackageDirectory) {
                                CodePushFileUtil.copyDirectoryEntriesTo(currentPackageDirectory, deployDir, copyCallback);
                            };
                            var fail = function (fileSystemError) {
                                copyCallback(CodePushFileUtil.fileErrorToError(fileSystemError), null);
                            };
                            window.resolveLocalFileSystemURL(currentPackage.localPath, success, fail);
                        }
                    }, applyError);
                });
            };
            var handleDiffDeployment = function (diffManifest) {
                /* copy old files */
                copyCurrentPackage(function (currentPackageError) {
                    /* copy new files */
                    handleCleanDeployment(function (cleanDeployError) {
                        /* delete files mentioned in the manifest */
                        var diffContent = CodePushFileUtil.readFileEntry(diffManifest, function (error, content) {
                            if (error || currentPackageError || cleanDeployError) {
                                applyError && applyError(new Error("Cannot perform diff-update."));
                            }
                            else {
                                var manifest = JSON.parse(content);
                                CodePushFileUtil.deleteEntriesFromDataDirectory(newPackageLocation, manifest.deletedFiles, function (deleteError) {
                                    CodePushFileUtil.getDataDirectory(newPackageLocation, true, function (deployDirError, deployDir) {
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
                    applyError && applyError(new Error("Could not unzip package. " + _this.getErrorMessage(unzipError)));
                }
                else {
                    CodePushFileUtil.getDataDirectory(newPackageLocation, true, function (deployDirError, deployDir) {
                        // check for diff manifest
                        CodePushFileUtil.getDataFile(CodePush.DownloadUnzipDir, CodePush.DiffManifestFile, false, function (manifestError, diffManifest) {
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
            CodePushFileUtil.getDataDirectory(CodePush.DownloadUnzipDir, false, function (error, directoryEntry) {
                var unzipPackage = function () {
                    CodePushFileUtil.getDataDirectory(CodePush.DownloadUnzipDir, true, function (innerError, unzipDir) {
                        if (innerError) {
                            applyError && applyError(innerError);
                        }
                        else {
                            zip.unzip(newPackage.localPath, unzipDir.toInternalURL(), newPackageUnzipped);
                        }
                    });
                };
                if (!error && !!directoryEntry) {
                    /* Unzip directory not clean */
                    directoryEntry.removeRecursively(function () {
                        unzipPackage();
                    }, function (cleanupError) {
                        applyError && applyError(CodePushFileUtil.fileErrorToError(cleanupError));
                    });
                }
                else {
                    unzipPackage();
                }
            });
        }
        catch (e) {
            applyError && applyError(new Error("An error ocurred while applying the package. " + this.getErrorMessage(e)));
        }
    };
    /**
     * Queries the Code Push server for updates.
     *
     * @param querySuccess Callback invoked in case of a successful response from the server.
     *                     The callback takes one RemotePackage parameter. A non-null package is a valid update.
     *                     A null package means the application is up to date.
     * @param queryError Optional callback invoked in case of an error.
     */
    CodePush.prototype.queryUpdate = function (querySuccess, queryError) {
        var _this = this;
        try {
            var callback = this.getNodeStyleCallbackFor(querySuccess, queryError);
            this.initialize(function (initError) {
                if (initError) {
                    queryError && queryError(initError);
                }
                else {
                    _this.getCurrentOrDefaultPackage(function (localPackage) {
                        _this.acquisitionManager.queryUpdateWithCurrentPackage(localPackage, callback);
                    }, function (error) {
                        queryError && queryError(error);
                    });
                }
            });
        }
        catch (e) {
            queryError && queryError(new Error("An error ocurred while querying for updates." + this.getErrorMessage(e)));
        }
    };
    CodePush.prototype.initialize = function (callback) {
        var _this = this;
        if (!this.initialized) {
            NativeAppInfo.getServerURL(function (serverError, serverURL) {
                NativeAppInfo.getDeploymentKey(function (depolymentKeyError, deploymentKey) {
                    if (!serverURL || !deploymentKey) {
                        callback(new Error("Could not get the Code Push configuration. Please check your config.xml file."), null);
                    }
                    else {
                        var configuration = { deploymentKey: deploymentKey, serverUrl: serverURL, ignoreAppVersion: _this.ignoreAppVersion };
                        _this.appDataDirectory = cordova.file.dataDirectory;
                        _this.acquisitionManager = new AcquisitionManager(new CodePushHttpRequester(), configuration);
                        _this.initialized = true;
                        callback(null, null);
                    }
                });
            });
        }
        else {
            /* already initialized */
            callback(null, null);
        }
    };
    /**
     * Given two Cordova style callbacks for success and error, this function returns a node.js
     * style callback where the error is the first parameter and the result the second.
     */
    CodePush.prototype.getNodeStyleCallbackFor = function (successCallback, errorCallback) {
        return function (error, result) {
            if (error) {
                errorCallback && errorCallback(error);
            }
            else {
                successCallback && successCallback(result);
            }
        };
    };
    /**
     * Gets the message of an error, if any.
     */
    CodePush.prototype.getErrorMessage = function (e) {
        var result;
        if (e && e.message) {
            return e.message;
        }
        return result;
    };
    CodePush.RootDir = "codepush";
    CodePush.DiffManifestFile = "hotcodepush.json";
    CodePush.PackageInfoFile = "currentPackage.json";
    CodePush.OldPackageInfoFile = "oldPackage.json";
    CodePush.PackageUpdateFileName = "update.zip";
    CodePush.DownloadDir = CodePush.RootDir + "/download";
    CodePush.DownloadUnzipDir = CodePush.DownloadDir + "/unzipped";
    CodePush.DeployDir = CodePush.RootDir + "/deploy";
    CodePush.VersionsDir = CodePush.DeployDir + "/versions";
    return CodePush;
})();
var instance = new CodePush();
module.exports = instance;

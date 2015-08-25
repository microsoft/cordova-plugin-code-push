
 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 ALSO, PLEASE DO NOT SUBMIT PULL REQUESTS WITH CHANGES TO THIS FILE. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.MD. 
 *********************************************************************************************/ 


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
var CodePush = (function () {
    function CodePush(ignoreAppVersion) {
        this.initialized = false;
        this.ignoreAppVersion = !!ignoreAppVersion;
    }
    CodePush.prototype.updateSucceeded = function (notifySucceeded, notifyFailed) {
        cordova.exec(notifySucceeded, notifyFailed, "CodePush", "updatesuccess", []);
    };
    CodePush.prototype.hasUpdatePreviouslyFailed = function (packageHash, checkSucceeded, checkFailed) {
        var win = function (failed) {
            checkSucceeded && checkSucceeded(!!failed);
        };
        var fail = function (e) {
            checkFailed && checkFailed(e);
        };
        cordova.exec(win, fail, "CodePush", "isfailedupdate", [packageHash]);
    };
    CodePush.prototype.getCurrentPackage = function (packageSuccess, packageError) {
        return this.getPackage(CodePush.PackageInfoFile, packageSuccess, packageError);
    };
    CodePush.prototype.getOldPackage = function (packageSuccess, packageError) {
        return this.getPackage(CodePush.OldPackageInfoFile, packageSuccess, packageError);
    };
    CodePush.prototype.getPackage = function (packageFile, packageSuccess, packageError) {
        var _this = this;
        var handleError = function (e) {
            packageError && packageError(new Error("Cannot read package information. " + _this.getErrorMessage(e)));
        };
        try {
            FileUtil.readDataFile(CodePush.RootDir, packageFile, function (error, content) {
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
        this.getPackageInfoOrDefault(CodePush.PackageInfoFile, packageSuccess, packageError);
    };
    CodePush.prototype.getOldOrDefaultPackage = function (packageSuccess, packageError) {
        this.getPackageInfoOrDefault(CodePush.OldPackageInfoFile, packageSuccess, packageError);
    };
    CodePush.prototype.getPackageInfoOrDefault = function (packageFile, packageSuccess, packageError) {
        var packageFailure = function (error) {
            NativeAppInfo.getApplicationVersion(function (appVersionError, appVersion) {
                if (appVersionError) {
                    console.log("Could not get application version." + appVersionError);
                    packageError(appVersionError);
                }
                else {
                    var defaultPackage = {
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
        this.getPackage(packageFile, packageSuccess, packageFailure);
    };
    CodePush.prototype.writeCurrentPackageInformation = function (packageInfoMetadata, callback) {
        var content = JSON.stringify(packageInfoMetadata);
        FileUtil.writeStringToDataFile(content, CodePush.RootDir, CodePush.PackageInfoFile, true, callback);
    };
    CodePush.prototype.writeOldPackageInformation = function (callback) {
        var reportFileError = function (error) {
            callback(FileUtil.fileErrorToError(error), null);
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
                FileUtil.getDataFile(CodePush.RootDir, CodePush.OldPackageInfoFile, false, function (error, oldPackageFile) {
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
        FileUtil.getDataFile(CodePush.RootDir, CodePush.PackageInfoFile, false, gotFile);
    };
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
    CodePush.prototype.abortDownload = function (abortSuccess, abortError) {
        try {
            if (this.currentFileTransfer) {
                this.currentFileTransfer.abort();
                abortSuccess && abortSuccess();
            }
        }
        catch (e) {
            abortError && abortError(e);
        }
    };
    CodePush.prototype.apply = function (newPackage, applySuccess, applyError) {
        this.applyWithRevertProtection(newPackage, 0, applySuccess, applyError);
    };
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
                _this.getCurrentOrDefaultPackage(function (oldPackage) {
                    _this.writeOldPackageInformation(function (backupError) {
                        backupError && console.log("Package information was not backed up. " + _this.getErrorMessage(backupError));
                        writeNewPackageMetadata(deployDir, function (writeMetadataError) {
                            if (writeMetadataError) {
                                applyError && applyError(writeMetadataError);
                            }
                            else {
                                var silentCleanup = function (cleanCallback) {
                                    deleteDirectory(CodePush.DownloadDir, function (e1) {
                                        cleanOldPackage(oldPackage, function (e2) {
                                            cleanCallback(e1 || e2, null);
                                        });
                                    });
                                };
                                var invokeSuccessAndApply = function () {
                                    applySuccess && applySuccess();
                                    cordova.exec(function () { }, function () { }, "CodePush", "apply", [deployDir.fullPath, applySuccessTimeoutMillis.toString()]);
                                };
                                var preApplySuccess = function () {
                                    if (applySuccessTimeoutMillis > 0) {
                                        invokeSuccessAndApply();
                                    }
                                    else {
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
                FileUtil.getDataDirectory(newPackageLocation, true, function (deployDirError, deployDir) {
                    FileUtil.getDataDirectory(CodePush.DownloadUnzipDir, false, function (unzipDirErr, unzipDir) {
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
                    _this.getCurrentPackage(function (currentPackage) {
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
                    applyError && applyError(new Error("Could not unzip package. " + _this.getErrorMessage(unzipError)));
                }
                else {
                    FileUtil.getDataDirectory(newPackageLocation, true, function (deployDirError, deployDir) {
                        FileUtil.getDataFile(CodePush.DownloadUnzipDir, CodePush.DiffManifestFile, false, function (manifestError, diffManifest) {
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
            FileUtil.getDataDirectory(CodePush.DownloadUnzipDir, false, function (error, directoryEntry) {
                var unzipPackage = function () {
                    FileUtil.getDataDirectory(CodePush.DownloadUnzipDir, true, function (innerError, unzipDir) {
                        if (innerError) {
                            applyError && applyError(innerError);
                        }
                        else {
                            zip.unzip(newPackage.localPath, unzipDir.toInternalURL(), newPackageUnzipped);
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
            applyError && applyError(new Error("An error ocurred while applying the package. " + this.getErrorMessage(e)));
        }
    };
    CodePush.prototype.didUpdate = function (didUpdateCallback) {
        var _this = this;
        var respondWithFalse = function () {
            didUpdateCallback(false, null, null);
        };
        var win = function (didUpdate) {
            if (!!didUpdate) {
                _this.getCurrentOrDefaultPackage(function (currentPackage) {
                    _this.getOldOrDefaultPackage(function (oldPackage) {
                        didUpdateCallback(true, oldPackage, currentPackage);
                    }, respondWithFalse);
                }, respondWithFalse);
            }
            else {
                respondWithFalse();
            }
        };
        var fail = function () {
            respondWithFalse();
        };
        cordova.exec(win, fail, "CodePush", "didUpdate", []);
    };
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
                        _this.acquisitionManager = new AcquisitionManager(new HttpRequester(), configuration);
                        _this.initialized = true;
                        callback(null, null);
                    }
                });
            });
        }
        else {
            callback(null, null);
        }
    };
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
var FileUtil = (function () {
    function FileUtil() {
    }
    FileUtil.directoryExists = function (rootUri, path, callback) {
        FileUtil.getDirectory(rootUri, path, false, function (error, dirEntry) {
            var dirExists = !error && !!dirEntry;
            callback(null, dirExists);
        });
    };
    FileUtil.fileErrorToError = function (fileError, message) {
        return new Error((message ? message : "An error has occurred while performing the operation. ") + " Error code: " + fileError.code);
    };
    FileUtil.getDataDirectory = function (path, createIfNotExists, callback) {
        FileUtil.getDirectory(cordova.file.dataDirectory, path, createIfNotExists, callback);
    };
    FileUtil.writeStringToDataFile = function (content, path, fileName, createIfNotExists, callback) {
        FileUtil.writeStringToFile(content, cordova.file.dataDirectory, path, fileName, createIfNotExists, callback);
    };
    FileUtil.getApplicationDirectory = function (path, callback) {
        FileUtil.getApplicationEntry(path, callback);
    };
    FileUtil.getApplicationFile = function (path, callback) {
        FileUtil.getApplicationEntry(path, callback);
    };
    FileUtil.getOrCreateFile = function (parent, path, createIfNotExists, success, fail) {
        var failFirst = function (error) {
            if (!createIfNotExists) {
                fail(error);
            }
            else {
                parent.getFile(path, { create: true, exclusive: false }, success, fail);
            }
        };
        parent.getFile(path, { create: false, exclusive: false }, success, failFirst);
    };
    FileUtil.getFile = function (rootUri, path, fileName, createIfNotExists, callback) {
        FileUtil.getDirectory(rootUri, path, createIfNotExists, function (error, directoryEntry) {
            if (error) {
                callback(error, null);
            }
            else {
                FileUtil.getOrCreateFile(directoryEntry, fileName, createIfNotExists, function (entry) { callback(null, entry); }, function (error) { callback(FileUtil.fileErrorToError(error), null); });
            }
        });
    };
    FileUtil.getDataFile = function (path, fileName, createIfNotExists, callback) {
        FileUtil.getFile(cordova.file.dataDirectory, path, fileName, createIfNotExists, callback);
    };
    FileUtil.fileExists = function (rootUri, path, fileName, callback) {
        FileUtil.getFile(rootUri, path, fileName, false, function (error, fileEntry) {
            var exists = !error && !!fileEntry;
            callback(null, exists);
        });
    };
    FileUtil.getDirectory = function (rootUri, path, createIfNotExists, callback) {
        var pathArray = path.split("/");
        var currentDir;
        var currentIndex = 0;
        var appDirError = function (error) {
            callback(new Error("Could not get application subdirectory. Error code: " + error.code), null);
        };
        var rootDirSuccess = function (appDir) {
            if (!createIfNotExists) {
                appDir.getDirectory(path, { create: false, exclusive: false }, function (directoryEntry) { callback(null, directoryEntry); }, appDirError);
            }
            else {
                currentDir = appDir;
                if (currentIndex >= pathArray.length) {
                    callback(null, appDir);
                }
                else {
                    var currentPath = pathArray[currentIndex];
                    currentIndex++;
                    if (currentPath) {
                        FileUtil.getOrCreateSubDirectory(appDir, currentPath, createIfNotExists, rootDirSuccess, appDirError);
                    }
                    else {
                        rootDirSuccess(appDir);
                    }
                }
            }
        };
        window.resolveLocalFileSystemURL(rootUri, rootDirSuccess, appDirError);
    };
    FileUtil.dataDirectoryExists = function (path, callback) {
        FileUtil.directoryExists(cordova.file.dataDirectory, path, callback);
    };
    FileUtil.copyDirectoryEntriesTo = function (sourceDir, destinationDir, callback) {
        var fail = function (error) {
            callback(FileUtil.fileErrorToError(error), null);
        };
        var success = function (entries) {
            var i = 0;
            var copyOne = function () {
                if (i < entries.length) {
                    var nextEntry = entries[i++];
                    var entryAlreadyInDestination = function (destinationEntry) {
                        var replaceError = function (fileError) {
                            callback(new Error("Error during entry replacement. Error code: " + fileError.code), null);
                        };
                        if (destinationEntry.isDirectory) {
                            FileUtil.copyDirectoryEntriesTo(nextEntry, destinationEntry, function (error) {
                                if (error) {
                                    callback(error, null);
                                }
                                else {
                                    copyOne();
                                }
                            });
                        }
                        else {
                            var fileEntry = destinationEntry;
                            fileEntry.remove(function () {
                                nextEntry.copyTo(destinationDir, nextEntry.name, copyOne, fail);
                            }, replaceError);
                        }
                    };
                    var entryNotInDestination = function (error) {
                        nextEntry.copyTo(destinationDir, nextEntry.name, copyOne, fail);
                    };
                    if (nextEntry.isDirectory) {
                        destinationDir.getDirectory(nextEntry.name, { create: false, exclusive: false }, entryAlreadyInDestination, entryNotInDestination);
                    }
                    else {
                        destinationDir.getFile(nextEntry.name, { create: false, exclusive: false }, entryAlreadyInDestination, entryNotInDestination);
                    }
                }
                else {
                    callback(null, null);
                }
            };
            copyOne();
        };
        var directoryReader = sourceDir.createReader();
        directoryReader.readEntries(success, fail);
    };
    FileUtil.deleteEntriesFromDataDirectory = function (dirPath, filesToDelete, callback) {
        FileUtil.getDataDirectory(dirPath, false, function (error, rootDir) {
            if (error) {
                callback(error, null);
            }
            else {
                var i = 0;
                var deleteOne = function () {
                    if (i < filesToDelete.length) {
                        var continueDeleting = function () {
                            i++;
                            deleteOne();
                        };
                        var fail = function (error) {
                            console.log("Could not delete file: " + filesToDelete[i]);
                            continueDeleting();
                        };
                        var success = function (entry) {
                            entry.remove(continueDeleting, fail);
                        };
                        rootDir.getFile(filesToDelete[i], { create: false, exclusive: false }, success, fail);
                    }
                    else {
                        callback(null, null);
                    }
                };
                deleteOne();
            }
        });
    };
    FileUtil.writeStringToFile = function (content, rootUri, path, fileName, createIfNotExists, callback) {
        var gotFile = function (fileEntry) {
            fileEntry.createWriter(function (writer) {
                writer.onwriteend = function (ev) {
                    callback(null, null);
                };
                writer.onerror = function (ev) {
                    callback(writer.error, null);
                };
                writer.write(content);
            }, function (error) {
                callback(new Error("Could write the current package information file. Error code: " + error.code), null);
            });
        };
        FileUtil.getFile(rootUri, path, fileName, createIfNotExists, function (error, fileEntry) {
            if (error) {
                callback(error, null);
            }
            else {
                gotFile(fileEntry);
            }
        });
    };
    FileUtil.readFileEntry = function (fileEntry, callback) {
        fileEntry.file(function (file) {
            var fileReader = new FileReader();
            fileReader.onloadend = function (ev) {
                callback(null, ev.target.result);
            };
            fileReader.onerror = function (ev) {
                callback(new Error("Could not get file. Error: " + ev.error), null);
            };
            fileReader.readAsText(file);
        }, function (error) {
            callback(new Error("Could not get file. Error code: " + error.code), null);
        });
    };
    FileUtil.readFile = function (rootUri, path, fileName, callback) {
        FileUtil.getFile(rootUri, path, fileName, false, function (error, fileEntry) {
            if (error) {
                callback(error, null);
            }
            else {
                FileUtil.readFileEntry(fileEntry, callback);
            }
        });
    };
    FileUtil.readDataFile = function (path, fileName, callback) {
        FileUtil.readFile(cordova.file.dataDirectory, path, fileName, callback);
    };
    FileUtil.getApplicationEntry = function (path, callback) {
        var success = function (entry) {
            callback(null, entry);
        };
        var fail = function (error) {
            callback(FileUtil.fileErrorToError(error), null);
        };
        window.resolveLocalFileSystemURL(cordova.file.applicationDirectory + path, success, fail);
    };
    FileUtil.getOrCreateSubDirectory = function (parent, path, createIfNotExists, success, fail) {
        var failFirst = function (error) {
            if (!createIfNotExists) {
                fail(error);
            }
            else {
                parent.getDirectory(path, { create: true, exclusive: false }, success, fail);
            }
        };
        parent.getDirectory(path, { create: false, exclusive: false }, success, failFirst);
    };
    return FileUtil;
})();
var HttpRequester = (function () {
    function HttpRequester() {
    }
    HttpRequester.prototype.request = function (verb, url, callbackOrRequestBody, callback) {
        var requestBody;
        var requestCallback = callback;
        if (!requestCallback && typeof callbackOrRequestBody === "function") {
            requestCallback = callbackOrRequestBody;
        }
        if (typeof callbackOrRequestBody === "string") {
            requestBody = callbackOrRequestBody;
        }
        var xhr = new XMLHttpRequest();
        var methodName = this.getHttpMethodName(verb);
        var callbackInvoked = false;
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (callbackInvoked) {
                    console.warn("Callback already invoked before.");
                }
                var response = { statusCode: xhr.status, body: xhr.responseText };
                requestCallback && requestCallback(null, response);
                callbackInvoked = true;
            }
        };
        xhr.open(methodName, url, true);
        xhr.send(requestBody);
    };
    HttpRequester.prototype.getHttpMethodName = function (verb) {
        switch (verb) {
            case 0:
                return "GET";
            case 7:
                return "CONNECT";
            case 4:
                return "DELETE";
            case 1:
                return "HEAD";
            case 6:
                return "OPTIONS";
            case 8:
                return "PATCH";
            case 2:
                return "POST";
            case 3:
                return "PUT";
            case 5:
                return "TRACE";
            default:
                return null;
        }
    };
    return HttpRequester;
})();
var NativeAppInfo = (function () {
    function NativeAppInfo() {
    }
    NativeAppInfo.getApplicationBuildTime = function (callback) {
        var timestampSuccess = function (timestamp) { callback(null, timestamp); };
        var timestampError = function () { callback(new Error("Could not get application timestamp."), null); };
        cordova.exec(timestampSuccess, timestampError, "CodePush", "getNativeBuildTime", []);
    };
    NativeAppInfo.getApplicationVersion = function (callback) {
        var versionSuccess = function (version) { callback(null, version); };
        var versionError = function () { callback(new Error("Could not get application version."), null); };
        cordova.exec(versionSuccess, versionError, "CodePush", "getAppVersion", []);
    };
    NativeAppInfo.getServerURL = function (serverCallback) {
        var serverSuccess = function (serverURL) { serverCallback(null, serverURL); };
        var serverError = function () { serverCallback(new Error("Server URL not found."), null); };
        cordova.exec(serverSuccess, serverError, "CodePush", "getServerURL", []);
    };
    NativeAppInfo.getDeploymentKey = function (deploymentKeyCallback) {
        var deploymentSuccess = function (deploymentKey) { deploymentKeyCallback(null, deploymentKey); };
        var deploymentError = function () { deploymentKeyCallback(new Error("Deployment key not found."), null); };
        cordova.exec(deploymentSuccess, deploymentError, "CodePush", "getDeploymentKey", []);
    };
    return NativeAppInfo;
})();
var instance = new CodePush();
module.exports = instance;


 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE DIRECTLY AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER, AND THEN RUN GULP. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.md. 
 *********************************************************************************************/ 


"use strict";
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
    FileUtil.copyDirectoryEntriesTo = function (sourceDir, destinationDir, ignoreList, callback) {
        if (ignoreList.indexOf(".DS_Store") === -1) {
            ignoreList.push(".DS_Store");
        }
        if (ignoreList.indexOf("__MACOSX") === -1) {
            ignoreList.push("__MACOSX");
        }
        var fail = function (error) {
            callback(FileUtil.fileErrorToError(error), null);
        };
        var success = function (entries) {
            var i = 0;
            var copyOne = function () {
                if (i < entries.length) {
                    var nextEntry = entries[i++];
                    if (ignoreList.indexOf(nextEntry.name) > 0) {
                        copyOne();
                    }
                    else {
                        var entryAlreadyInDestination = function (destinationEntry) {
                            var replaceError = function (fileError) {
                                callback(new Error("Error during entry replacement. Error code: " + fileError.code), null);
                            };
                            if (destinationEntry.isDirectory) {
                                FileUtil.copyDirectoryEntriesTo(nextEntry, destinationEntry, ignoreList, function (error) {
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
                        FileUtil.entryExistsInDirectory(nextEntry, destinationDir, entryAlreadyInDestination, entryNotInDestination);
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
    FileUtil.entryExistsInDirectory = function (entry, destinationDir, exists, doesNotExist) {
        var options = { create: false, exclusive: false };
        if (entry.isDirectory) {
            destinationDir.getDirectory(entry.name, options, exists, doesNotExist);
        }
        else {
            destinationDir.getFile(entry.name, options, exists, doesNotExist);
        }
    };
    FileUtil.deleteDirectory = function (dirLocation, deleteDirCallback) {
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
            fileReader.onerror = function () {
                callback(new Error("Could not get file. Error: " + fileReader.error.message), null);
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
}());
module.exports = FileUtil;

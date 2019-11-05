/// <reference path="../typings/codePush.d.ts" />
/// <reference types="cordova-plugin-file" />
/// <reference types="cordova" />

"use strict";

declare var cordova: Cordova;

/**
 * File utilities for CodePush.
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

        /* check if the file exists first - getFile fails if the file exists and the create flag is set to true */
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

    public static copyDirectoryEntriesTo(sourceDir: DirectoryEntry, destinationDir: DirectoryEntry, ignoreList: string[], callback: Callback<void>): void {
        /*
            Native-side exception occurs while trying to copy “.DS_Store” and “__MACOSX” entries generated by macOS, so just skip them
        */
        if (ignoreList.indexOf(".DS_Store") === -1){
            ignoreList.push(".DS_Store");
        }
        if (ignoreList.indexOf("__MACOSX") === -1){
            ignoreList.push("__MACOSX");
        }

        var fail = (error: FileError) => {
            callback(FileUtil.fileErrorToError(error), null);
        };

        var success = (entries: Entry[]) => {
            var i = 0;

            var copyOne = () => {
                if (i < entries.length) {
                    var nextEntry = entries[i++];
                    /* recursively call copyOne on copy success */
                    if (ignoreList.indexOf(nextEntry.name) > 0) {
                        copyOne();
                    } else {
                        var entryAlreadyInDestination = (destinationEntry: Entry) => {
                            var replaceError = (fileError: FileError) => {
                                callback(new Error("Error during entry replacement. Error code: " + fileError.code), null);
                            };

                            if (destinationEntry.isDirectory) {
                                /* directory */
                                FileUtil.copyDirectoryEntriesTo(<DirectoryEntry>nextEntry, <DirectoryEntry>destinationEntry, ignoreList, (error: Error) => {
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

                        FileUtil.entryExistsInDirectory(nextEntry, destinationDir, entryAlreadyInDestination, entryNotInDestination);
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

    /**
     * Checks if an entry already exists in a given directory.
     */
    public static entryExistsInDirectory(entry: Entry, destinationDir: DirectoryEntry, exists: SuccessCallback<Entry>, doesNotExist: { (error: FileError): void; }): void {
        var options: Flags = { create: false, exclusive: false };

        if (entry.isDirectory) {
            destinationDir.getDirectory(entry.name, options, exists, doesNotExist);
        } else {
            destinationDir.getFile(entry.name, options, exists, doesNotExist);
        }
    }

    /**
     * Recursively deletes the contents of a directory.
     */
    public static deleteDirectory(dirLocation: string, deleteDirCallback: Callback<void>) {
        FileUtil.getDataDirectory(dirLocation, false, (oldDirError: Error, dirToDelete: DirectoryEntry) => {
            if (oldDirError) {
                deleteDirCallback(oldDirError, null);
            } else {
                var win = () => { deleteDirCallback(null, null); };
                var fail = (e: FileError) => { deleteDirCallback(FileUtil.fileErrorToError(e), null); };
                dirToDelete.removeRecursively(win, fail);
            }
        });
    }

    /**
     * Deletes a given set of files from a directory.
     */
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

    /**
     * Writes a string to a file.
     */
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
            fileReader.onloadend = (ev: ProgressEvent) => {
                callback(null, fileReader.result as string);
            };

            fileReader.onerror = () => {
                callback(new Error("Could not get file. Error: " + fileReader.error.message), null);
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

export = FileUtil;

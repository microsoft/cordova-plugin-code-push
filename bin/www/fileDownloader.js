
 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE DIRECTLY AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER, AND THEN RUN GULP. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.md. 
 *********************************************************************************************/ 


"use strict";
var FileDownloader = (function () {
    function FileDownloader() {
    }
    FileDownloader.prototype.download = function (source, target, successCallback, errorCallback) {
        var _this = this;
        window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function (fs) {
            fs.root.getFile(target, { create: true, exclusive: false }, function (fileEntry) {
                _this._xhr = new XMLHttpRequest();
                _this._xhr.open('GET', source, true);
                _this._xhr.responseType = 'blob';
                if (_this.onprogress) {
                    _this._xhr.onprogress = _this.onprogress;
                }
                _this._xhr.onload = function (oEvent) {
                    var blob = _this._xhr.response;
                    if (blob) {
                        fileEntry.createWriter(function (fileWriter) {
                            fileWriter.onwriteend = function (e) {
                                successCallback(fileEntry);
                            };
                            fileWriter.onerror = function (e) {
                                errorCallback(new Error('Could not save response to local filesystem! ' + e.toString()));
                            };
                            fileWriter.write(blob);
                        });
                    }
                    else
                        errorCallback(new Error('Could not download binary blob!'));
                };
                _this._xhr.send(null);
            }, errorCallback);
        }, errorCallback);
    };
    FileDownloader.prototype.abort = function () {
        if (this._xhr) {
            this._xhr.abort();
            this._xhr = null;
        }
    };
    return FileDownloader;
}());
module.exports = FileDownloader;

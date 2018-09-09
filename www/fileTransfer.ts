class FileTransfer {
    onprogress: ((ev: ProgressEvent) => void) | null;
    private _xhr: XMLHttpRequest;

    download(source: string, target: string, successCallback: (fileEntry: FileEntry) => void, errorCallback: (err: FileError | Error) => void) {
        window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, (fs) => {
            fs.root.getFile(target, {create: true, exclusive: false}, (fileEntry: FileEntry) => {
                this._xhr = new XMLHttpRequest();
                this._xhr.open('GET', source, true);
                this._xhr.responseType = 'blob';

                if (this.onprogress) {
                    this._xhr.onprogress = this.onprogress;
                }

                this._xhr.onload = (oEvent) => {
                    const blob = this._xhr.response; // Note: not .responseText
                    if (blob) {
                        // Create a FileWriter object for our FileSystemFileEntry.
                        fileEntry.createWriter((fileWriter) => {
                            fileWriter.onwriteend = (e) => {
                                successCallback(fileEntry);
                            };

                            fileWriter.onerror = (e) => {
                                errorCallback(new Error('Could not save response to local filesystem! ' + e.toString()));
                            };

                            // Create a new Blob and write it to target
                            fileWriter.write(blob);
                        });
                    } else errorCallback(new Error('Could not download binary blob!'));
                };
                this._xhr.send(null);
            }, errorCallback);
        }, errorCallback);
    }

    abort() {
        if (this._xhr) {
            this._xhr.abort();
            this._xhr = null;
        }
    }
}

export = FileTransfer;

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
                    const blob = this._xhr.response; // Note: not oReq.responseText
                    if (blob) {
                        successCallback(fileEntry);
                        this._xhr = null;
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

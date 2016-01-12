var app = {
    // Application Constructor
    initialize: function () {
        this.bindEvents();
    },
    bindEvents: function () {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    onDeviceReady: function () {
        app.receivedDeviceReady();
        app.checkForUpdates();
    },
    // Update DOM on a Received Event
    receivedDeviceReady: function () {
        document.getElementById("deviceready").innerText = "Device is ready (scenario - install on next resume)";
        console.log('Received Event: deviceready');
    },
    checkForUpdates: function () {
        console.log("Checking for updates...");
        window.codePush.checkForUpdate(app.checkSuccess, app.checkError);
    },
    checkSuccess: function (remotePackage) {
        if (!remotePackage) {
            // A null remotePackage means that the server successfully responded, but there is no update available.
            console.log("The application is up to date.");
            app.sendTestMessage("CHECK_UP_TO_DATE");
        }
        else {
            if (remotePackage.failedInstall) {
                app.sendTestMessage("UPDATE_FAILED_PREVIOUSLY");
            } else {
                console.log("There is an update available. Remote package:" + JSON.stringify(remotePackage));
                console.log("Downloading package...");
                remotePackage.download(app.downloadSuccess, app.downloadError);
            }
        }
    },
    checkError: function (error) {
        console.log("An error occured while checking for updates.");
        app.sendTestMessage("CHECK_ERROR");
    },
    downloadSuccess: function (localPackage) {
        console.log("Download succeeded.");
        localPackage.install(app.installSuccess, app.installError, { installMode: InstallMode.ON_NEXT_RESUME });
    },
    downloadError: function (error) {
        console.log("Download error.");
        app.sendTestMessage("DOWNLOAD_ERROR");
    },
    installSuccess: function () {
        console.log("Update installed.");
        app.sendTestMessage("UPDATE_INSTALLED");
    },
    installError: function (error) {
        console.log("Install error.");
        app.sendTestMessage("INSTALL_ERROR");
    },
    sendTestMessage: function (message, args) {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "CODE_PUSH_SERVER_URL/reportTestMessage", false);
        var body = JSON.stringify({ message: message, args: args });
        console.log("Sending test message body: " + body);

        xhr.setRequestHeader("Content-type", "application/json");

        xhr.send(body);
    }
};

app.initialize();
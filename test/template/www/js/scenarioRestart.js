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
    },
    // Update DOM on a Received Event
    receivedDeviceReady: function () {
        document.getElementById("deviceready").innerText = "Device is ready (scenario - restart)";
        console.log('Received Event: deviceready');

        /* send the packages, expecting null pending package and null current package */
        app.sendCurrentAndPendingPackage(function () {
            window.codePush.sync(
                function (status) {
                    app.sendTestMessage("SYNC_STATUS", [status]);
                    if (status == SyncStatus.UPDATE_INSTALLED) {
                        /* send packages, expending non-null pending and null current */
                        app.sendCurrentAndPendingPackage(function () {
                            app.tryRestart();
                        });
                    }
                },
                {
                    installMode: InstallMode.ON_NEXT_RESTART
                });
        });
    },
    /* tries to restart the application and sends the status to the mock server */
    tryRestart: function (callback) {
        window.codePush.restartApplication(
            function () {
                callback && callback();
            },
            function () {
                /* error */
                app.sendTestMessage("RESTART_FAILED");
                callback && callback();
            });
    },
    /* sends the current and pending package to the mock server */
    sendCurrentAndPendingPackage: function (callback) {
        window.codePush.getPendingPackage(function (pendingPackage) {
            console.log("Pending package: " + pendingPackage);
            app.sendTestMessage("PENDING_PACKAGE", [pendingPackage ? pendingPackage.packageHash : null]);
            window.codePush.getCurrentPackage(function (currentPackage) {
                console.log("Current package: " + currentPackage);
                app.sendTestMessage("CURRENT_PACKAGE", [currentPackage ? currentPackage.packageHash : null]);
                callback && callback();
            });
        });
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
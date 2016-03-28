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
        document.getElementById("deviceready").innerText = "Device is ready (scenario - sync 2x)";
        console.log('Received Event: deviceready');
        /* invoke sync with no UI options */
        window.codePush.sync(
            function (status) {
                app.sendTestMessage("SYNC_STATUS", [status]);
            },
            {
                installMode: InstallMode.IMMEDIATE
            });
        /* Only send the sync status of the second sync as a test message */
        window.codePush.sync(
            function (status) {
                app.sendTestMessage("SYNC_STATUS", [status]);
            },
            {
                installMode: InstallMode.IMMEDIATE
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
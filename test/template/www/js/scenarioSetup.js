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
        document.getElementById("deviceready").innerText = "Device is ready (scenario - setup, getting native build time)";
        console.log('Received Event: deviceready');

        var timestamp;

        var timestampSuccess = function (timestampFromNative) {
            timestamp = timestampFromNative;
            document.getElementById("deviceready").innerText = "Device is ready (scenario - setup, native build time = " + timestamp + ")";
            cordova.exec(filesDirectorySuccess, error, "CodePush", "getFilesDirectory", []);
        };
        var filesDirectorySuccess = function (filesDirectory) {
            document.getElementById("deviceready").innerText = "Device is ready (scenario - setup, native build time = " + timestamp + ", filesDirectory = " + filesDirectory + ")";
            app.sendNativeEnv(timestamp, filesDirectory);
        }
        var error = function () {
            document.getElementById("deviceready").innerText = "Device is ready (scenario - setup, FAIL)";
            app.sendNativeEnv(0, "null");
        };
        
        cordova.exec(timestampSuccess, error, "CodePush", "getNativeBuildTime", []);
    },
    sendNativeEnv: function (timestamp, filesDir) {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "CODE_PUSH_SERVER_URL/reportNativeEnv", false);
        var body = JSON.stringify({ nativeBuildTime: timestamp, filesDirectory: filesDir });
        console.log("Sending test message body: " + body);

        xhr.setRequestHeader("Content-type", "application/json");

        xhr.send(body);
    }
};

app.initialize();
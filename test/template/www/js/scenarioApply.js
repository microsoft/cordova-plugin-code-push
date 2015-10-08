/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
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
        document.getElementById("deviceready").innerText = "Device is ready (scenario - apply)";
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
            console.log("There is an update available. Remote package:" + JSON.stringify(remotePackage));
            console.log("Downloading package...");
            remotePackage.download(app.downloadSuccess, app.downloadError);
        }
    },
    checkError: function (error) {
        console.log("An error ocurred while checking for errors.");
        app.sendTestMessage("CHECK_ERROR");
    },
    downloadSuccess: function (localPackage) {
        console.log("Download succeeded.");
        localPackage.apply(app.applySuccess, app.applyError);
    },
    downloadError: function (error) {
        console.log("Download error.");
        app.sendTestMessage("DOWNLOAD_ERROR");
    },
    applySuccess: function () {
        console.log("Apply success.");
        app.sendTestMessage("APPLY_SUCCESS");
    },
    applyError: function (error) {
        console.log("Apply error.");
        app.sendTestMessage("APPLY_ERROR");
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
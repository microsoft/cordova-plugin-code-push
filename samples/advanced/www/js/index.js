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
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function () {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function () {
        // Migrate data from older versions
        window.codePush.getCurrentPackage(function (currentPackage) {
            // getCurrentPackage returns null if no update was installed (binary version)
            if (currentPackage && currentPackage.isFirstRun) {
                // First run after an update, migrate data
                if (currentPackage.appVersion === "1.0.0") {
                    // migrate data from binary version to version 1.0.0
                } else if (currentPackage.appVersion === "2.0.0") {
                    // migrate data to version 2.0.0
                }
            }
            
            // continue application initialization
            app.receivedEvent('deviceready');
            
            // Wait for 5s after the application started and check for updates.
            setTimeout(app.checkAndInstallUpdates, 5000);
            
            // Notify the plugin that update succeeded.
            window.codePush.notifyApplicationReady();

        }, app.getErrorHandler("Error while retrieving the current package."));
    },
    // Update DOM on a Received Event
    receivedEvent: function (id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        console.log('Received Event: ' + id);
    },
    // Uses the CodePush service configured in config.xml to check for updates, prompt the user and install them.
    checkAndInstallUpdates: function () {
        
        // Check the CodePush server for updates.
        console.log("Checking for updates...");
        window.codePush.checkForUpdate(app.checkSuccess, app.getErrorHandler("Checking for update failed."));
    },
    // Called after the CodePush server responded the checkForUpdate call
    checkSuccess: function (remotePackage) {
        if (!remotePackage) {
            // A null remotePackage means that the server successfully responded, but there is no update available.
            console.log("The application is up to date.");
        }
        else {
            console.log("There is an update available. Remote package:" + JSON.stringify(remotePackage));
                
            // Called after the user confirmed or canceled the update 
            function onConfirm(buttonIndex) {
                switch (buttonIndex) {
                    case 1:
                        /* Install */
                        console.log("Downloading package...");
                        remotePackage.download(app.onDownloadSuccess, app.getErrorHandler("Downloading the update package failed."));
                        break;
                    case 2:
                        /* Cancel */
                        /* nothing to do */
                        break;
                }
            }

            // Ask the user if they want to download and install the update
            navigator.notification.confirm(
                'An update is available. Would you like to download and install it?',
                onConfirm,
                'Update'
                ['Install', 'Cancel']);
        }
    },
    // Called after an update package was downloaded sucessfully.
    onDownloadSuccess: function (localPackage) {
        console.log("Local package downloaded. Local package: " + localPackage.localPath);

        var installCallback = function () {
            console.log("Install succeeded");
        };

        console.log("Installing package...");
        localPackage.install(installCallback, app.getErrorHandler("Installation failed."), { installMode: InstallMode.IMMEDIATE });
    },
    // Returns an error handler that logs the error to the console and displays a notification containing the error message.
    getErrorHandler: function (message) {
        // Displays a dialog containing a message.
        var displayErrorMessage = function (message) {
            navigator.notification.alert(
                message,
                null,
                'CodePush',
                'OK');
        };

        return function (error) {
            console.log(message + ":" + error.message);
            displayErrorMessage(message + ":" + error.message);
        }
    }
};

app.initialize();
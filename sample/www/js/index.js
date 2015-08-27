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
        navigator.codePush.didUpdate(function (didUpdate, oldPackage, newPackage) {
            if (didUpdate) {
                // first app run after update
                if (oldPackage.label == null && newPackage.label === "1.0.0") {
                    // migrate data from store version to version 1.0.0
                } else if (oldPackage.label == null && newPackage.label === "2.0.0") {
                    // migrate data from store version to version 2.0.0
                } else if (oldPackage.label === "1.0.0" && newPackage.label === "2.0.0") {
                    // migrate data from version 1.0.0 to version 2.0.0
                }
                // else { /* migrate other version combinations */}
                
                /* Notify the plugin that update succeeded. This is only required when using navigator.codePush.applyWithRevertProtection for applying the update. */
                // navigator.codePush.updateSucceeded();
            }
            
            // continue application initialization
            app.receivedEvent('deviceready');
            
            // Wait for 5s after the application started and check for updates.
            setTimeout(app.checkAndInstallUpdates, 5000);
        });
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
    // Uses the Code Push service configured in config.xml to check for updates, prompt the user and install them.
    checkAndInstallUpdates: function () {
        
        // Check the Code Push server for updates.
        console.log("Checking for updates...");
        navigator.codePush.queryUpdate(app.onQuerySuccess, app.getErrorHandler("Checking for update failed."));
    },
    // Called after the Code Push server responded the queryUpdate call
    onQuerySuccess: function (remotePackage) {
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
                        navigator.codePush.download(remotePackage, app.onDownloadSuccess, app.getErrorHandler("Downloading the update package failed."));
                        break;
                    case 2:
                        /* Cancel */
                        /* nothing to do */
                        break;
                }
            }

            // Ask the user if they want to download and apply the update
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

        var applyCallback = function () {
            console.log("Apply succeeded");
        };

        console.log("Applying package...");
        navigator.codePush.apply(localPackage, applyCallback, app.getErrorHandler("Apply failed."));
    },
    // Returns an error handler that logs the error to the console and displays a notification containing the error message.
    getErrorHandler: function (message) {
        // Displays a dialog containing a message.
        var displayErrorMessage = function (message) {
            navigator.notification.alert(
                message,
                null,
                'Code Push',
                'OK');
        };

        return function (error) {
            console.log(message + ":" + error.message);
            displayErrorMessage(message + ":" + error.message);
        }
    }
};

app.initialize();
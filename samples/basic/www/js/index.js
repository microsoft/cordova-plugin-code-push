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
        /* Invoke sync with the default options, which enables user interaction.
           For customizing the sync behavior, see SyncOptions in the CodePush documentation. */
        window.codePush.sync(function (syncStatus) {
            switch (syncStatus) {
                case SyncStatus.APPLY_SUCCESS:
                    console.log("The update was applied successfully. This is the last callback before the application is reloaded with the updated content.");
                    /* Don't continue app initialization, the application will refresh after this return. */
                    return;
                case SyncStatus.UP_TO_DATE:
                    app.displayMessage("The application is up to date.");
                    break;
                case SyncStatus.UPDATE_IGNORED:
                    app.displayMessage("The user decided not to install the optional update.");
                    break;
                case SyncStatus.ERROR:
                    app.displayMessage("An error ocurred while checking for updates");
                    break;
            }
            
            // continue application initialization
            app.receivedEvent('deviceready');
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
    // Displays an alert dialog containing a message.
    displayMessage: function (message) {
        navigator.notification.alert(
            message,
            null,
            'CodePush',
            'OK');
    }
};

app.initialize();
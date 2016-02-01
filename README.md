# Cordova Plugin for CodePush
This plugin provides client-side integration with the [CodePush service](http://codepush.tools), allowing you to easily update your Cordova app(s).

## How does it work?
A Cordova application's assets (HTML, JavaScript, CSS files and other resources) are traditionally loaded from the application installation location on the target device. After you submit an update to the store, the user downloads the update, and those assets will be replaced with the new assets.

CodePush is here to simplify this process by allowing you to instantly update your application's assets without having to submit a new update to the store. We do this by packaging the application assets in a zip archive and sending it to the CodePush server. In the application, we install and persist the update. Then, since these are all web assets, the application will just reload from the updated package location. We store the update packages in the internal storage of the device.

For an easy way to get started, please see our [sample applications](/samples) and our [getting started guide](#getting-started).

## Supported platforms
Cordova 5.0.0+ is fully supported, along with the following asociated platforms:

- Android ([cordova-android](https://github.com/apache/cordova-android) 4.0.0+)
- iOS ([cordova-ios](https://github.com/apache/cordova-ios) 3.9.0+)

To check which versions of each Cordova platform you are currently using, you can run the following command:

```shell
cordova platform version
```

## Getting Started
Once you've followed the general-purpose ["getting started"](http://microsoft.github.io/code-push//docs/getting-started.html) instructions for setting up your CodePush account, you can start CodePush-ifying your Cordova app by running the following command from within your app's root directory:

```shell
cordova plugin add cordova-plugin-code-push
```

With the CodePush plugin installed, configure your app to use it via the following steps:

1. Add your deployment keys to the `config.xml` file, making sure to include the right key for each Cordova platform:

    ```xml
    <platform name="android">
        <preference name="CodePushDeploymentKey" value="YOUR-ANDROID-DEPLOYMENT-KEY" />
    </platform>
    <platform name="ios">
        <preference name="CodePushDeploymentKey" value="YOUR-IOS-DEPLOYMENT-KEY" />
    </platform>
    ```
    
    *NOTE: If you're only developing for a single platform, then you only need to specify the deployment key for either Android or iOS, so you don't need to add the additional `<platform>` element as illustrated above.*
    
2. If you're already using an `<access origin"*" />` element in your `config.xml` file, then you can skip this step. Otherwise, add the following additional `<access />` elements to ensure that your app can access the CodePush server endpoints:
 
    ```xml
    <access origin="https://codepush.azurewebsites.net" />
    <access orogin="https://codepush.blob.core.windows.net" />
    ```
    
3. To ensure that your app can access the CodePush server on [CSP](https://developer.mozilla.org/en-US/docs/Web/Security/CSP/Introducing_Content_Security_Policy)-compliant platforms, add `https://codepush.azurewebsites.net` to the `Content-Security-Policy` `meta` tag in your `index.html` file:
  
    ```xml
    <meta http-equiv="Content-Security-Policy" content="default-src https://codepush.azurewebsites.net/ 'self' data: gap: https://ssl.gstatic.com 'unsafe-eval'; style-src 'self' 'unsafe-inline'; media-src *" />
    ```
   
You are now ready to use the plugin in the application code. See the [sample applications](/samples) for examples and the API documentation for more details.

## Plugin Usage
With the CodePush plugin installed and configured, the only thing left is to add the necessary code to your app to control the following policies:

1. When (and how often) to check for an update? (e.g. app start, in response to clicking a button in a settings page, periodically at some fixed interval)

2. When an update is available, how to present it to the end user?

The simplest way to do this is to perform the following in your app's `deviceready` event handler:

```javascript
codePush.sync();
```

If an update is available, it will be silently downloaded, and installed the next time the app is restarted (either explicitly by the end user or by the OS), which ensures the least invasive experience for your end users. If you would like to display a confirmation dialog (an "active install"), or customize the update experience in any way, refer to the sync method's API reference for information on how to tweak this default behavior.

## Releasing Updates
Once your app has been configured and distributed to your users, and you've made some changes, it's time to release it to them instantly! To do this, simply perform the following steps:

1. Prepare your app's updated `www` folder by running the following command:

    ```shell
    cordova prepare
    ```
    
    *NOTE: We are not deploying binaries via CodePush, so running a `prepare` is more enough for this step. The `cordova build` command works as well, since it calls `cordova prepare` behind the scenes, so you can also choose to run the `build` command if you prefer.*
  
2. Release the updated app code to the CodePush server via the CodePush [management CLI](https://github.com/Microsoft/code-push/tree/master/cli). To do this, use the following CLIs commands, depending on the platform your update is targetting:

| Platform | Release Command                                                                                                                              |
|----------|----------------------------------------------------------------------------------------------------------------------------------------------|
| Android  | `code-push release <appName> <path_to_your_app>/platforms/android/assets/www <targetBinaryVersion> --deploymentName <AndroidDeploymentName>` |
| iOS      | `code-push release <appName> <path_to_your_app>/platforms/ios/www <targetBinaryVersion> --deploymentName <iOSDeploymentName>`                |

*NOTE: The `<targetBinaryVersion>` parameter needs to be set to the exact value of the `<widget version>` attribute (e.g. `1.0.0`) in your `config.xml` file.*

Your update will now be available to your app as soon as it calls either `codePush.checkForUpdate` or `codePush.sync`.

## API Reference
The CodePush API is exposed to your app via the global `codePush` object, which is available after the `deviceready` event fires. This API exposes the following top-level methods:

- __[checkForUpdate](#codepushcheckforupdate)__: Checks the server for update packages.
- __[getCurrentPackage](#codepushgetcurrentpackage)__: Gets information about the currently applied package.
- __[notifyApplicationReady](#codepushnotifyapplicationready)__: Notifies the plugin that the update operation succeeded.
- __[sync](#codepushsync)__: Convenience function for installing updates in one call.

Additionally, the following objects and enums are also exposed globally as part of the CodePush API:

- __[InstallMode](#installmode)__: Defines the available install modes for updates.
- __[LocalPackage](#localpackage)__: Contains information about a locally installed package.
- __[RemotePackage](#remotepackage)__: Contains information about an update package available for download.
- __[SyncStatus](#syncstatus)__: Defines the possible intermediate and result statuses of the [sync](#codepushsync) operation.

### codePush.checkForUpdate
Queries the CodePush server for updates.

```javascript
codePush.checkForUpdate(onUpdateCheck, onError, deploymentKey);
```

- __onUpdateCheck__ Callback invoked in case of a successful response from the server. The callback takes one `RemotePackage` parameter. A non-null package is a valid update. A null package means the application is up to date for the current native application version.

- __onError__ Optional callback invoked in case of an error. The callback takes one error parameter, containing the details of the error.

- __deploymentKey__ Optional deployment key that overrides the config.xml setting.

#### Example
```javascript
var onError = function (error) {
    console.log("An error occurred. " + error);
};

var onUpdateCheck = function (remotePackage) {
    if (!remotePackage) {
        console.log("The application is up to date.");
    } else {
        console.log("A CodePush update is available. Package hash: " + remotePackage.packageHash);
    }
};

window.codePush.checkForUpdate(onUpdateCheck, onError);
```

### codePush.getCurrentPackage

```javascript
codePush.getCurrentPackage(onPackageSuccess, onError);
```

Get the currently installed package information. 

- __onPackageSuccess__: Callback invoked with the currently deployed package information. If the application did not install updates yet, ```packageSuccess``` will be called with a ```null``` argument.

- __onError__: Optional callback invoked in case of an error.

#### Example
```javascript
var onError = function (error) {
    console.log("An error occurred. " + error);
};

var onPackageSuccess = function (localPackage) {
    if (!localPackage) {
        console.log("The application has no CodePush updates installed (App Store Version).");
    } else {
        console.log("The currently installed CodePush update: " + localPackage.packageHash);
    }
};

window.codePush.getCurrentPackage(onPackageSuccess, onError);
```

### codePush.notifyApplicationReady
```javascript
codePush.notifyApplicationReady(notifySucceeded, notifyFailed);
```
Notifies the plugin that the update operation succeeded and that the application is ready.
Calling this function is required on the first run after an update. On every subsequent application run, calling this function is a noop.
If using the sync API, calling this function is not required since sync calls it internally. 

- __notifySucceeded__: Optional callback invoked if the plugin was successfully notified.
- __notifyFailed__: Optional callback invoked in case of an error during notifying the plugin.

#### Example
```javascript
// App version 1 (current version)

var onError = function (error) {
    console.log("An error occurred. " + error);
};

var onInstallSuccess = function () {
    console.log("Installation succeeded.");
};

var onPackageDownloaded = function (localPackage) {
    localPackage.install(onInstallSuccess, onError);
};

var onUpdateCheck = function (remotePackage) {
    if (!remotePackage) {
        console.log("The application is up to date.");
    } else {
        // The hash of each previously reverted package is stored for later use. 
        // This way, we avoid going into an infinite bad update/revert loop.
        if (!remotePackage.failedInstall) {
            console.log("A CodePush update is available. Package hash: " + remotePackage.packageHash);
            remotePackage.download(onPackageDownloaded, onError);
        } else {
            console.log("The available update was attempted before and failed.");
        }
    }
};

window.codePush.checkForUpdate(onUpdateCheck, onError);

//------------------------------------------------

// App version 2 (updated version)

var app = {
    onDeviceReady: function () {
        // Calling this function is requirede during the first application run after an update.
        // If not called, the application will be reverted to the previous version.
        window.codePush.notifyApplicationReady();
        // ...
    }
}
```

### codePush.sync

```javascript
codePush.sync(syncCallback, syncOptions, downloadProgress);
```
Convenience method for installing updates in one method call.
This method is provided for simplicity, and its behavior can be replicated by using window.codePush.checkForUpdate(), RemotePackage's download() and LocalPackage's install() methods.
The algorithm of this method is the following:
- Check for an update on the CodePush server.
  - If an update is available
    - If the update is mandatory and the alertMessage is set in options, the user will be informed that the application will be updated to the latest version. The update package will then be downloaded and applied. 
    - If the update is not mandatory and the confirmMessage is set in options, the user will be asked if they want to update to the latest version. If they decline, the syncCallback will be invoked with SyncStatus.UPDATE_IGNORED status.
    - Otherwise, the update package will be downloaded and applied with no user interaction.
- If no update is available on the server, the syncCallback will be invoked with the SyncStatus.UP_TO_DATE status.
- If an error occurs during checking for update, downloading or installing it, the syncCallback will be invoked with the SyncStatus.ERROR status.

- __syncCallback__: Optional callback to be called with the status of the sync operation. The callback will be called multiple times. It will be called at least one time with an intermediate status, and only one time (the final call) with a result status. The possible statuses are defined by the SyncStatus enum.
- __syncOptions__: Optional SyncOptions parameter configuring the behavior of the sync operation.
- __downloadProgress__: Optional callback invoked during the download process. It is called several times with one DownloadProgress parameter.

#### SyncOptions
Interface defining several options for customizing the [sync](#codepushsync) operation behavior.

- __installMode__: Used to specity the [InstallMode](#installmode) used for the install operation. This is optional and defaults to InstallMode.ON_NEXT_RESTART.
- __ignoreFailedUpdates__: Optional boolean flag. If set, updates available on the server for which and update was attempted and rolled back will be ignored. Defaults to true. (boolean)
- __updateDialog__: Option used to enable, disable or customize the user interaction during sync. If set to false, user interaction will be disabled. If set to true, the user will be alerted or asked to confirm new updates, based on whether the update is mandatory. To customize the user dialog, this option can be set to a custom UpdateDialogOptions instance.
- __deploymentKey__: Option used to override the config.xml deployment key when checking for updates.

##### UpdateDialogOptions
Interface defining the configuration options for the alert or confirmation dialog.

- __mandatoryUpdateMessage__:  If a mandatory update is available and this option is set, the message will be displayed to the user in an alert dialog before downloading and installing the update. The user will not be able to cancel the operation, since the update is mandatory. (string)
- __optionalUpdateMessage__: If an optional update is available and this option is set, the message will be displayed to the user in a confirmation dialog. If the user confirms the update, it will be downloaded and installed. Otherwise, the update update is not downloaded. (string)
- __updateTitle__: The title of the dialog box used for interacting with the user in case of a mandatory or optional update. This title will only be used if at least one of mandatoryUpdateMessage or optionalUpdateMessage options are set. (string)
- __optionalInstallButtonLabel__: The label of the confirmation button in case of an optional update. (string)
- __optionalIgnoreButtonLabel__: The label of the cancel button in case of an optional update. (string)
- __mandatoryContinueButtonLabel__: The label of the continue button in case of a mandatory update. (string)
- __appendReleaseDescription__: Flag indicating if the update description provided by the CodePush server should be displayed in the dialog box appended to the update message. Defaults to false. (boolean)
- __descriptionPrefix__: Optional prefix to add to the release description. (string)

#### Example
```javascript

// Using default sync options: user interaction is disabled

 /* Invoke sync with the custom options, which enables user interaction.
           For customizing the sync behavior, see SyncOptions in the CodePush documentation. */
window.codePush.sync(
    function (syncStatus) {
        switch (syncStatus) {
            // Result (final) statuses
            case SyncStatus.UPDATE_INSTALLED:
                console.log("The update was installed successfully. For InstallMode.ON_NEXT_RESTART, the changes will be visible after application restart. ");
                break;
            case SyncStatus.UP_TO_DATE:
                console.log("The application is up to date.");
                break;
            case SyncStatus.UPDATE_IGNORED:
                console.log("The user decided not to install the optional update.");
                break;
            case SyncStatus.ERROR:
                console.log("An error occured while checking for updates");
                break;
            
            // Intermediate (non final) statuses
            case SyncStatus.CHECKING_FOR_UPDATE:
                console.log("Checking for update.");
                break;
            case SyncStatus.AWAITING_USER_ACTION:
                console.log("Alerting user.");
                break;
            case SyncStatus.DOWNLOADING_PACKAGE:
                console.log("Downloading package.");
                break;
            case SyncStatus.INSTALLING_UPDATE:
                console.log("Installing update");
                break;
        }
    });

//------------------------------------------------

// Using custom sync options - user interaction is enabled, custom install mode and download progress callback

window.codePush.sync(
    function (syncStatus) {
        switch (syncStatus) {
            // Result (final) statuses
            case SyncStatus.UPDATE_INSTALLED:
                console.log("The update was installed successfully. For InstallMode.ON_NEXT_RESTART, the changes will be visible after application restart. ");
                break;
            case SyncStatus.UP_TO_DATE:
                console.log("The application is up to date.");
                break;
            case SyncStatus.UPDATE_IGNORED:
                console.log("The user decided not to install the optional update.");
                break;
            case SyncStatus.ERROR:
                console.log("An error occured while checking for updates");
                break;
            
            // Intermediate (non final) statuses
            case SyncStatus.CHECKING_FOR_UPDATE:
                console.log("Checking for update.");
                break;
            case SyncStatus.AWAITING_USER_ACTION:
                console.log("Alerting user.");
                break;
            case SyncStatus.DOWNLOADING_PACKAGE:
                console.log("Downloading package.");
                break;
            case SyncStatus.INSTALLING_UPDATE:
                console.log("Installing update");
                break;
        }
    },
    {
        updateDialog: true, installMode: InstallMode.ON_NEXT_RESUME
    },
    function (downloadProgress) {
        console.log("Downloading " + downloadProgress.receivedBytes + " of " + downloadProgress.totalBytes + " bytes.");
    });


//------------------------------------------------

// Using custom sync options - custom update dialog

var updateDialogOptions = {
    updateTitle: "Update",
    mandatoryUpdateMessage: "You will be updated to the latest version of the app.",
    mandatoryContinueButtonLabel: "Continue",
    optionalUpdateMessage: "Update available. Install?",
    optionalIgnoreButtonLabel: "No",
    optionalInstallButtonLabel: "Yes",
};

var syncOptions = {
    installMode: InstallMode.ON_NEXT_RESTART,
    updateDialog: updateDialogOptions
};

var syncStatusCallback = function (syncStatus) {
    switch (syncStatus) {
        // Result (final) statuses
        case SyncStatus.UPDATE_INSTALLED:
            app.displayMessage("The update was installed successfully. For InstallMode.ON_NEXT_RESTART, the changes will be visible after application restart. ");
            break;
        case SyncStatus.UP_TO_DATE:
            app.displayMessage("The application is up to date.");
            break;
        case SyncStatus.UPDATE_IGNORED:
            app.displayMessage("The user decided not to install the optional update.");
            break;
        case SyncStatus.ERROR:
            app.displayMessage("An error occured while checking for updates");
            break;
            
        // Intermediate (non final) statuses
        case SyncStatus.CHECKING_FOR_UPDATE:
            console.log("Checking for update.");
            break;
        case SyncStatus.AWAITING_USER_ACTION:
            console.log("Alerting user.");
            break;
        case SyncStatus.DOWNLOADING_PACKAGE:
            console.log("Downloading package.");
            break;
        case SyncStatus.INSTALLING_UPDATE:
            console.log("Installing update");
            break;
    }
};
       
/* Invoke sync with custom messages in the update dialog.
   For customizing the sync behavior, see SyncOptions in the CodePush documentation. */
window.codePush.sync(syncStatusCallback, syncOptions);

```

### Package objects

The `checkForUpdate` and `getCurrentPackage` methods provide acces to "package" objects. A package represents a specific CodePush update along with its metadata (e.g. description, mandatory?). The CodePush API has the distinction between the following two types of packages:

#### LocalPackage
Contains details about an update package that has been downloaded locally or already applied (currently installed package).

##### Properties

- __deploymentKey__: Deployment key of the package. (String)
- __description__: Package description. (String)
- __label__: Package label. (String)
- __appVersion__: The native version of the application this package update is intended for. (String)
- __isMandatory__: Flag indicating if the update is mandatory. (Boolean)
- __packageHash__: The hash value of the package. (String)
- __packageSize__: The size of the package, in bytes. (Number)
- __failedInstall__: Boolean flag indicating if this update package was previously attempted and the update failed. (Boolean). For an example on how to protect against a bad update, see the [notifyApplicationReady() documentation](#codepushnotifyapplicationready).
- __localPath__: The current, local path of the package. (String)
- __isFirstRun__: Flag indicating if the current application run is the first one after the package was applied. (Boolean)

##### Methods

- __install(installSuccess, installError, installOptions)__: Installs this package to the application.
The install behavior is dependent on the provided `installOptions`. By default, the update package is silently installed and the application is reloaded with the new content on the next application start.
On the first run after the update, the application will wait for a `codePush.notifyApplicationReady()` call. Once this call is made, the install operation is considered a success.
Otherwise, the install operation will be marked as failed, and the application is reverted to its previous version on the next run.

    ###### InstallOptions

    Interface defining several options for customizing install operation behavior.

    - __installMode__: Used to specity the [InstallMode](#installmode) used for the install operation. This is optional and defaults to InstallMode.ON_NEXT_RESTART.

##### Example

```javascript
// App version 1 (current version)

var onError = function (error) {
    console.log("An error occurred. " + error);
};

var onInstallSuccess = function () {
    console.log("Installation succeeded.");
};

var onPackageDownloaded = function (localPackage) {
    localPackage.install(onInstallSuccess, onError, { installMode: InstallMode.ON_NEXT_RESUME });
};

var onUpdateCheck = function (remotePackage) {
    if (!remotePackage) {
        console.log("The application is up to date.");
    } else {
        // The hash of each previously reverted package is stored for later use. 
        // This way, we avoid going into an infinite bad update/revert loop.
        if (!remotePackage.failedInstall) {
            console.log("A CodePush update is available. Package hash: " + remotePackage.packageHash);
            remotePackage.download(onPackageDownloaded, onError);
        } else {
            console.log("The available update was attempted before and failed.");
        }
    }
};

window.codePush.checkForUpdate(onUpdateCheck, onError);

//------------------------------------------------

// App version 2 (updated version)

var app = {
    onDeviceReady: function () {
        // Calling this function is requirede during the first application run after an update.
        // If not called, the application will be reverted to the previous version.
        window.codePush.notifyApplicationReady();
        // ...
    }
}
```

For an example on how you are protected against a bad update, see the [notifyApplicationReady() documentation](#codepushnotifyapplicationready).

#### RemotePackage

Contains details about an update package that is available for download.

##### Properties

- __deploymentKey__: Deployment key of the package. (String)
- __description__: Package description. (String)
- __label__: Package label. (String)
- __appVersion__: The native version of the application this package update is intended for. (String)
- __isMandatory__: Flag indicating if the update is mandatory. (Boolean)
- __packageHash__: The hash value of the package. (String)
- __packageSize__: The size of the package, in bytes. (Number)
- __failedInstall__: Boolean flag indicating if this update package was previously attempted and the update failed. (Boolean)
- __downloadUrl__: The URL at which the package is available for download. (String)

##### Methods

- __abortDownload(abortSuccess, abortError)__: Aborts the current download session, if any.
- __download(downloadSuccess, downloadError, downloadProgress)__: Downloads the package update from the CodePush service. The ```downloadSuccess``` callback is invoked with a [LocalPackage](#localpackage) argument, representing the downloaded package.
The optional `downloadProgress` callback is invoked several times during the download progress with one `DownloadProgress` parameter.

    ###### DownloadProgress

    Defines the format of the DownloadProgress object, used to send periodical update notifications on the progress of the update download.

    ####### Properties

    - __totalBytes__: The size of the downloading update package, in bytes. (Number)
    - __receivedBytes__: The number of bytes already downloaded. (Number)

##### Example

```javascript
var onError = function (error) {
    console.log("An error occurred. " + error);
};

var onPackageDownloaded = function (localPackage) {
    console.log("Package downloaded at: " + localPackage.localPath);
    // you can now update your application to the downloaded version by calling localPackage.install()
};

var onProgress = function (downloadProgress) {
    console.log("Downloading " + downloadProgress.receivedBytes + " of " + downloadProgress.totalBytes + " bytes.");
};

var onUpdateCheck = function (remotePackage) {
    if (!remotePackage) {
        console.log("The application is up to date.");
    } else {
        console.log("A CodePush update is available. Package hash: " + remotePackage.packageHash);
        remotePackage.download(onPackageDownloaded, onError, onProgress);
    }
};

window.codePush.checkForUpdate(onUpdateCheck, onError);
```

### Enums
The CodePush API includes the following "enum" objects which can be used to customize the update experience, and are available globally off of the `window` object:

#### InstallMode
Defines the available install modes for update packages.

- __IMMEDIATE__: The update will be applied to the running application immediately. The application will be reloaded with the new content immediately.
- __ON_NEXT_RESTART__: The update is downloaded but not installed immediately. The new content will be available the next time the application is started.
- __ON_NEXT_RESUME__: The udpate is downloaded but not installed immediately. The new content will be available the next time the application is resumed or restarted, whichever event happends first.

#### SyncStatus
Defines the possible statuses of the [sync](#codepushsync) operation. There are two categories of statuses: intermediate and result (final). The intermediate statuses represent progress statuses of the sync operation, and are not final. The result statuses represent final statuses of the sync operation. Every sync operation ends with only one result status, but can have zero or more intermediate statuses.

- __UP_TO_DATE__: Result status - the application is up to date. (number)
- __UPDATE_INSTALLED__: Result status - an update is available, it has been downloaded, unzipped and copied to the deployment folder. After the completion of the callback invoked with SyncStatus.UPDATE_INSTALLED, the application will be reloaded with the updated code and resources. (number)
- __UPDATE_IGNORED__: Result status - an optional update is available, but the user declined to install it. The update was not downloaded. (number)
- __ERROR__: Result status - an error happened during the sync operation. This might be an error while communicating with the server, downloading or unziping the update. The console logs should contain more information about what happened. No update has been applied in this case. (number)
- __CHECKING_FOR_UPDATE__: Intermediate status - the plugin is about to check for updates.
- __AWAITING_USER_ACTION__: Intermediate status - a user dialog is about to be displayed. This status will be reported only if user interaction is enabled.
- __DOWNLOADING_PACKAGE__: Intermediate status - the update package is about to be downloaded.
- __INSTALLING_UPDATE__: Intermediate status - the update package is about to be installed.

## Compiling sources & contributing
The JavaScript code in this plugin is compiled from TypeScript. Please see [this page](CONTRIBUTING.md) for more details on contributing and how to build the project.

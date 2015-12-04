# cordova-plugin-code-push

This plugin provides integration with the CodePush service, allowing you to easily update your Cordova application.

Access to the plugin is through the ```window.codePush``` object. The object is available after the ```deviceready``` event.

## Installation


	cordova plugin add cordova-plugin-code-push


## Supported platforms

- Android
- iOS

## How does it work?

A Cordova application's assets (HTML, JavaScript, CSS files and other resources) are traditionally loaded from the application installation location on the target device. After you submit an update to the store, the user downloads the update, and those assets will be replaced with the new assets.

CodePush is here to simplify this process by allowing you to instantly update your application's assets without having to submit a new update to the store. We do this by packaging the application assets in a zip archive and sending it to the CodePush server. In the application, we install and persist the update. Then, since these are all web assets, the application will just reload from the updated package location. We store the update packages in the internal storage of the device.

For an easy way to get started, please see our [sample applications](/samples) and our [getting started guide](#getting-started).

## Compiling sources & contributing

The JavaScript code in this plugin is compiled from TypeScript. Please see [this page](CONTRIBUTING.md) for more details on contributing and how to build the project.

## Methods
- __[checkForUpdate](#codepushcheckforupdate)__: Checks the server for update packages.
- __[notifyApplicationReady](#codepushnotifyapplicationready)__: Notifies the plugin that the update operation succeeded.
- __[getCurrentPackage](#codepushgetcurrentpackage)__: Gets information about the currently applied package.
- __[sync](#codepushsync)__: Convenience function for installing updates in one call.

## Objects
- __[LocalPackage](#localpackage)__: Contains information about a locally installed package.
- __[RemotePackage](#remotepackage)__: Contains information about an update package available for download.
- __[SyncStatus](#syncstatus)__: Defines the possible intermediate and result statuses of the [sync](#codepushsync) operation.
- __[InstallMode](#installmode)__: Defines the available install modes for updates.

## Getting started
- Add the plugin to your application.
- Create one deployment per target platform using the [CodePush CLI](https://github.com/Microsoft/code-push/tree/master/cli)
- Add the deployment keys to your ```config.xml```
```xml
    <platform name="android">
        <preference name="CodePushDeploymentKey" value="YOUR-ANDROID-DEPLOYMENT-KEY" />
    </platform>
    <platform name="ios">
        <preference name="CodePushDeploymentKey" value="YOUR-IOS-DEPLOYMENT-KEY" />
    </platform>
```
- Allow access to the CodePush server:
  - In ```config.xml```, add 
  ```xml
  <access origin="https://codepush.azurewebsites.net/ " />
  ```
  - In your html pages where the plugin is used, add the server URL to your existing Content Security Policy (CSP) header:
  ```xml
  <meta http-equiv="Content-Security-Policy" content="default-src https://codepush.azurewebsites.net/ 'self' ... ">
   ```
- You are now ready to use the plugin in the application code. See the [sample applications](/samples) for a examples and the methods description for more details.

## Create an application update package
You can create an update by simply zipping and deploying your platform's www folder. The [CodePush CLI](https://github.com/Microsoft/code-push/tree/master/cli) has a ```deploy``` command for this.

1. Prepare your application

  ```
  cordova prepare
  ```
  We are not deploying binaries in updates, so `prepare` is enough for this step. The `cordova build` command works as well for this step, since it calls `cordova prepare` behind the scenes.
  
2. Deploy update using the [CodePush CLI](https://github.com/Microsoft/code-push/tree/master/cli)

  - For Android:
  ```
  code-push release <appName> path_to_your_app/platforms/android/assets/www <appStoreVersion> --deploymentName <AndroidDeploymentName>
  ```
  - For iOS:
  ```
  code-push release <appName> path_to_your_app/platforms/ios/www <appStoreVersion> --deploymentName <iOSDeploymentName>
  ```

The service should now return an update when calling ```codePush.checkForUpdate```.

## LocalPackage
Contains details about an update package that has been downloaded locally or already applied (currently installed package).
### Properties
- __deploymentKey__: Deployment key of the package. (String)
- __description__: Package description. (String)
- __label__: Package label. (String)
- __appVersion__: The native version of the application this package update is intended for. (String)
- __isMandatory__: Flag indicating if the update is mandatory. (Boolean)
- __packageHash__: The hash value of the package. (String)
- __packageSize__: The size of the package, in bytes. (Number)
- __failedInstall__: Boolean flag indicating if this update package was previously attempted and the update failed. (Boolean). If using the rollback feature, this field can protect against going into an infinite bad update/revert loop. For an example on how to use the rollbackTimeout parameter to protect against a bad update, see the [notifyApplicationReady() documentation](#codepushnotifyapplicationready).
- __localPath__: The current, local path of the package. (String)
- __isFirstRun__: Flag indicating if the current application run is the first one after the package was applied. (Boolean)

### Methods
- __install(installSuccess, installError, installOptions)__: Installs this package to the application.
The install behavior is dependent on the provided `installOptions`. By default, the update package is silently installed and the application is reloaded with the new content on the next application start.
If the installOptions.rollbackTimeout parameter is provided, the application will wait for a `codePush.notifyApplicationReady()` for the given number of milliseconds.
If `codePush.notifyApplicationReady()` is called before the time period specified by `rollbackTimeout`, the install operation is considered a success.
Otherwise, the install operation will be marked as failed, and the application is reverted to its previous version.

### InstallOptions
Interface defining several options for customizing install operation behavior.

- __rollbackTimeout__: Optional time interval, in milliseconds, to wait for a [notifyApplicationReady()](#codepushnotifyapplicationready) call before marking the install as failed and reverting to the previous version. By default, the rollback functionality is disabled - the parameter defaults to 0. (number)
- __installMode__: Used to specity the InstallMode used for the install operation. This is optional and defaults to InstallMode.ON_NEXT_RESTART.

  #### Example
	```javascript
	var onError = function (error) {
	    console.log("An error occurred. " + error);
	};
	
	var onInstallSuccess = function () {
	    console.log("Install succeeded. Reloading the application...");
	};
	
	var onPackageDownloaded = function (localPackage) {
	    localPackage.install(onInstallSuccess, onError);
	};
	
	var onUpdateCheck = function (remotePackage) {
	    if (!remotePackage) {
	        console.log("The application is up to date.");
	    } else {
	        console.log("A CodePush update is available. Package hash: " + remotePackage.packageHash);
	        remotePackage.download(onPackageDownloaded, onError);
	    }
	};
	
	window.codePush.checkForUpdate(onUpdateCheck, onError);
	```

For an example on how to use the rollbackTimeout parameter to protect against a bad update, see the [notifyApplicationReady() documentation](#codepushnotifyapplicationready).

## RemotePackage
Contains details about an update package that is available for download.
### Properties
- __deploymentKey__: Deployment key of the package. (String)
- __description__: Package description. (String)
- __label__: Package label. (String)
- __appVersion__: The native version of the application this package update is intended for. (String)
- __isMandatory__: Flag indicating if the update is mandatory. (Boolean)
- __packageHash__: The hash value of the package. (String)
- __packageSize__: The size of the package, in bytes. (Number)
- __failedInstall__: Boolean flag indicating if this update package was previously attempted and the update failed. (Boolean)
- __downloadUrl__: The URL at which the package is available for download. (String)

### Methods
- __download(downloadSuccess, downloadError, downloadProgress)__: Downloads the package update from the CodePush service. The ```downloadSuccess``` callback is invoked with a ```LocalPackage``` argument, representing the downloaded package.
The optional `downloadProgress` callback is invoked several times during the download progress with one `DownloadProgress` parameter.

### DownloadProgress
Defines the format of the DownloadProgress object, used to send periodical update notifications on the progress of the update download.

#### Properties
- __totalBytes__: The size of the downloading update package, in bytes.
- __receivedBytes__: The number of bytes already downloaded.

  ### Example
  ```javascript
  	var onError = function (error) {
    	    console.log("An error occurred. " + error);
	};
	
	var onPackageDownloaded = function (localPackage) {
	    console.log("Package downloaded at: " + localPackage.localPath);
	    // you can now update your application to the downloaded version by calling localPackage.install()
	};
	
	var onUpdateCheck = function (remotePackage) {
	    if (!remotePackage) {
	        console.log("The application is up to date.");
	    } else {
	        console.log("A CodePush update is available. Package hash: " + remotePackage.packageHash);
	        remotePackage.download(onPackageDownloaded, onError);
	    }
	};
	
	window.codePush.checkForUpdate(onUpdateCheck, onError);
  ```
- __abortDownload(abortSuccess, abortError)__: Aborts the current download session, if any.

## SyncStatus
Defines the possible statuses of the [sync](#codepushsync) operation. There are two categories of statuses: intermediate and result (final). The intermediate statuses represent progress statuses of the sync operation, and are not final. The result statuses represent final statuses of the sync operation. Every sync operation ends with only one result status, but can have zero or more intermediate statuses.
### Properties
- __UP_TO_DATE__: Result status - the application is up to date. (number)
- __UPDATE_INSTALLED__: Result status - an update is available, it has been downloaded, unzipped and copied to the deployment folder. After the completion of the callback invoked with SyncStatus.UPDATE_INSTALLED, the application will be reloaded with the updated code and resources. (number)
- __UPDATE_IGNORED__: Result status - an optional update is available, but the user declined to install it. The update was not downloaded. (number)
- __ERROR__: Result status - an error happened during the sync operation. This might be an error while communicating with the server, downloading or unziping the update. The console logs should contain more information about what happened. No update has been applied in this case. (number)
- __CHECKING_FOR_UPDATE__: Intermediate status - the plugin is about to check for updates.
- __AWAITING_USER_ACTION__: Intermediate status - a user dialog is about to be displayed. This status will be reported only if user interaction is enabled.
- __DOWNLOADING_PACKAGE__: Intermediate status - the update package is about to be downloaded.
- __INSTALLING_UPDATE__: Intermediate status - the update package is about to be installed.

## codePush.checkForUpdate
Queries the CodePush server for updates.
```javascript
codePush.checkForUpdate(onUpdateCheck, onError, deploymentKey);
```
- __onUpdateCheck__ Callback invoked in case of a successful response from the server.
                         The callback takes one ```RemotePackage``` parameter. A non-null package is a valid update.
                         A null package means the application is up to date for the current native application version.
- __onError__ Optional callback invoked in case of an error. The callback takes one error parameter, containing the details of the error.
- __deploymentKey__ Optional deployment key that overrides the config.xml setting.

### Example
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

## codePush.getCurrentPackage
```javascript
codePush.getCurrentPackage(onPackageSuccess, onError);
```
Get the currently installed package information. 
- __onPackageSuccess__: Callback invoked with the currently deployed package information. If the application did not install updates yet, ```packageSuccess``` will be called with a ```null``` argument.
- __onError__: Optional callback invoked in case of an error.

### Example
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

## codePush.notifyApplicationReady
```javascript
codePush.notifyApplicationReady(notifySucceeded, notifyFailed);
```
Notifies the plugin that the update operation succeeded.
Calling this function is required if a installOptions.rollbackTimeout parameter is passed to your ```LocalPackage.install``` call.
If automatic rollback was not used, calling this function is not required and will result in a noop.
- __notifySucceeded__: Optional callback invoked if the plugin was successfully notified.
- __notifyFailed__: Optional callback invoked in case of an error during notifying the plugin.

### Example
```javascript
// App version 1 (current version)

var onError = function (error) {
    console.log("An error occurred. " + error);
};

var onInstallSuccess = function () {
    console.log("Installation succeeded. Reloading the application...");
};

var onPackageDownloaded = function (localPackage) {
    // set the rollbackTimeout to 10s
    localPackage.install(onInstallSuccess, onError, 10000);
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
        // If this call is not made in 10s after the updated version of the application is loaded,
        // the application will be reverted to the previous version
        window.codePush.notifyApplicationReady();
        // ...
    }
}
```

## codePush.sync
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

- __syncCallback__: Optional callback to be called with the status of the sync operation. The callback will be called only once, and the possible statuses are defined by the SyncStatus enum.
- __syncOptions__: Optional SyncOptions parameter configuring the behavior of the sync operation.
- __downloadProgress__: Optional callback invoked during the download process. It is called several times with one DownloadProgress parameter.

### SyncOptions
Interface defining several options for customizing the [sync](#codepushsync) operation behavior. Options span from disabling the user interaction or modifying it to enabling rollback in case of a bad update.

- __rollbackTimeout__: Optional time interval, in milliseconds, to wait for a [notifyApplicationReady()](#codepushnotifyapplicationready) call before marking the install as failed and reverting to the previous version. Sync calls [notifyApplicationReady()](#codepushnotifyapplicationready) internally, so if you use sync() in your updated version of the application, there is no need to call [notifyApplicationReady()](#codepushnotifyapplicationready) again. By default, the rollback functionality is disabled - the parameter defaults to 0. (number)
- __installMode__: Used to specity the InstallMode used for the install operation. This is optional and defaults to InstallMode.ON_NEXT_RESTART.
- __ignoreFailedUpdates__: Optional boolean flag. If set, updates available on the server for which and update was attempted and rolled back will be ignored. Defaults to true. (boolean)
- __updatedialog__: Option used to enable, disable or customize the user interaction during sync. If set to false, user interaction will be disabled. If set to true, the user will be alerted or asked to confirm new updates, based on whether the update is mandatory. To customize the user dialog, this option can be set to a custom UpdateDialogOptions instance.
- __deploymentKey__: Option used to override the config.xml deployment key when checking for updates.

### UpdateDialogOptions
Interface defining the configuration options for the alert or confirmation dialog.

- __mandatoryUpdateMessage__:  If a mandatory update is available and this option is set, the message will be displayed to the user in an alert dialog before downloading and installing the update. The user will not be able to cancel the operation, since the update is mandatory. (string)
- __optionalUpdateMessage__: If an optional update is available and this option is set, the message will be displayed to the user in a confirmation dialog. If the user confirms the update, it will be downloaded and installed. Otherwise, the update update is not downloaded. (string)
- __updateTitle__: The title of the dialog box used for interacting with the user in case of a mandatory or optional update. This title will only be used if at least one of mandatoryUpdateMessage or optionalUpdateMessage options are set. (string)
- __optionalInstallButtonLabel__: The label of the confirmation button in case of an optional update. (string)
- __optionalIgnoreButtonLabel__: The label of the cancel button in case of an optional update. (string)
- __mandatoryContinueButtonLabel__: The label of the continue button in case of a mandatory update. (string)
- __appendReleaseDescription__: Flag indicating if the update description provided by the CodePush server should be displayed in the dialog box appended to the update message. Defaults to false. (boolean)
- __descriptionPrefix__: Optional prefix to add to the release description. (string)

### Example
```javascript

// Using default sync options: user interaction is enabled

window.codePush.sync(function (syncStatus) {
    switch (syncStatus) {
        case SyncStatus.UPDATE_INSTALLED:
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
            app.displayMessage("An error occured while checking for updates");
            break;
    }
    
    // continue application initialization
    
});

//------------------------------------------------

// Using custom sync options

var syncOptions = {
    mandatoryUpdateMessage: "You will be updated to the latest version of the application.",
    mandatoryContinueButtonLabel: "Continue",
    optionalUpdateMessage: "There is an update available. Do you want to install it?",
    optionalIgnoreButtonLabel: "Maybe later",
    optionalInstallButtonLabel: "Yes",
    appendReleaseDescription: true,
    descriptionPrefix: "Release notes: "
};

window.codePush.sync(function (syncStatus) {
    switch (syncStatus) {
        case SyncStatus.UPDATE_INSTALLED:
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
            app.displayMessage("An error occured while checking for updates");
            break;
    }
    
    // continue application initialization
    
}, syncOptions);

```

## InstallMode
Defines the available install modes for update packages.

### Properties
- __IMMEDIATE__: The update will be applied to the running application immediately. The application will be reloaded with the new content immediately.
- __ON_NEXT_RESTART__: The update is downloaded but not installed immediately. The new content will be available the next time the application is started.
- __ON_NEXT_RESUME__: The udpate is downloaded but not installed immediately. The new content will be available the next time the application is resumed or restarted, whichever event happends first.

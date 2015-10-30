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
- __[SyncStatus](#syncstatus)__: Defines the possible result statuses of the [sync](#codepushsync) operation.

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

1. Build your application

  ```
  cordova build
  ```
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
- __failedApply__: Boolean flag indicating if this update package was previously attempted and the update failed. (Boolean). If using the rollback feature, this field can protect against going into an infinite bad update/revert loop. For an example on how to use the rollbackTimeout parameter to protect against a bad update, see the [notifyApplicationReady() documentation](#codepushnotifyapplicationready).
- __localPath__: The current, local path of the package. (String)
- __isFirstRun__: Flag indicating if the current application run is the first one after the package was applied. (Boolean)

### Methods
- __apply(applySuccess, applyError, rollbackTimeout)__: Applies this package to the application. The application will be reloaded with this package and on every application launch this package will be loaded.
If the rollbackTimeout parameter is provided, the application will wait for a `codePush.notifyApplicationReady()` for the given number of milliseconds.
If `codePush.notifyApplicationReady()` is called before the time period specified by `rollbackTimeout`, the apply operation is considered a success.
Otherwise, the apply operation will be marked as failed, and the application is reverted to its previous version.

  #### Example
	```javascript
	var onError = function (error) {
	    console.log("An error occurred. " + error);
	};
	
	var onApplySuccess = function () {
	    console.log("Apply succeeded. Reloading the application...");
	};
	
	var onPackageDownloaded = function (localPackage) {
	    localPackage.apply(onApplySuccess, onError);
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
- __failedApply__: Boolean flag indicating if this update package was previously attempted and the update failed. (Boolean)
- __downloadUrl__: The URL at which the package is available for download. (String)

### Methods
- __download(downloadSuccess, downloadError)__: Downloads the package update from the CodePush service. The ```downloadSuccess``` callback is invoked with a ```LocalPackage``` argument, representing the downloaded package.
  ### Example
  ```javascript
  	var onError = function (error) {
    	    console.log("An error occurred. " + error);
	};
	
	var onPackageDownloaded = function (localPackage) {
	    console.log("Package downloaded at: " + localPackage.localPath);
	    // you can now update your application to the downloaded version by calling localPackage.apply()
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
Defines the possible result statuses of the [sync](#codepushsync) operation.
### Properties
- __UP_TO_DATE__: The application is up to date. (number)
- __APPLY_SUCCESS__: An update is available, it has been downloaded, unzipped and copied to the deployment folder. After the completion of the callback invoked with SyncStatus.APPLY_SUCCESS, the application will be reloaded with the updated code and resources. (number)
- __UPDATE_IGNORED__: An optional update is available, but the user declined to install it. The update was not downloaded. (number)
- __ERROR__: An error happened during the sync operation. This might be an error while communicating with the server, downloading or unziping the update. The console logs should contain more information about what happened. No update has been applied in this case. (number)

## codePush.checkForUpdate
Queries the CodePush server for updates.
```javascript
codePush.checkForUpdate(onUpdateCheck, onError);
```
- __onUpdateCheck__ Callback invoked in case of a successful response from the server.
                         The callback takes one ```RemotePackage``` parameter. A non-null package is a valid update.
                         A null package means the application is up to date for the current native application version.
- __onError__ Optional callback invoked in case of an error. The callback takes one error parameter, containing the details of the error.

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
Calling this function is required if a rollbackTimeout parameter is passed to your ```LocalPackage.apply``` call.
If automatic rollback was not used, calling this function is not required and will result in a noop.
- __notifySucceeded__: Optional callback invoked if the plugin was successfully notified.
- __notifyFailed__: Optional callback invoked in case of an error during notifying the plugin.

### Example
```javascript
// App version 1 (current version)

var onError = function (error) {
    console.log("An error occurred. " + error);
};

var onApplySuccess = function () {
    console.log("Apply succeeded. Reloading the application...");
};

var onPackageDownloaded = function (localPackage) {
    // set the rollbackTimeout to 10s
    localPackage.apply(onApplySuccess, onError, 10000);
};

var onUpdateCheck = function (remotePackage) {
    if (!remotePackage) {
        console.log("The application is up to date.");
    } else {
        // The hash of each previously reverted package is stored for later use. 
        // This way, we avoid going into an infinite bad update/revert loop.
        if (!remotePackage.failedApply) {
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
codePush.sync(syncCallback, syncOptions);
```
Convenience method for installing updates in one method call.
This method is provided for simplicity, and its behavior can be replicated by using window.codePush.checkForUpdate(), RemotePackage's download() and LocalPackage's apply() methods.
The algorithm of this method is the following:
- Check for an update on the CodePush server.
  - If an update is available
    - If the update is mandatory and the alertMessage is set in options, the user will be informed that the application will be updated to the latest version. The update package will then be downloaded and applied. 
    - If the update is not mandatory and the confirmMessage is set in options, the user will be asked if they want to update to the latest version. If they decline, the syncCallback will be invoked with SyncStatus.UPDATE_IGNORED status.
    - Otherwise, the update package will be downloaded and applied with no user interaction.
- If no update is available on the server, the syncCallback will be invoked with the SyncStatus.UP_TO_DATE status.
- If an error ocurrs during checking for update, downloading or applying it, the syncCallback will be invoked with the SyncStatus.ERROR status.

- __syncCallback__: Optional callback to be called with the status of the sync operation. The callback will be called only once, and the possible statuses are defined by the SyncStatus enum.
- __syncOptions__: Optional SyncOptions parameter configuring the behavior of the sync operation.

### SyncOptions
Interface defining several options for customizing the [sync](#codepushsync) operation behavior. Options span from disabling the user interaction or modifying it to enabling rollback in case of a bad update.
- __mandatoryUpdateMessage__:  If a mandatory update is available and this option is set, the message will be displayed to the user in an alert dialog before downloading and installing the update. The user will not be able to cancel the operation, since the update is mandatory. (string)
- __optionalUpdateMessage__: If an optional update is available and this option is set, the message will be displayed to the user in a confirmation dialog. If the user confirms the update, it will be downloaded and installed. Otherwise, the update update is not downloaded. (string)
- __updateTitle__: The title of the dialog box used for interacting with the user in case of a mandatory or optional update. This title will only be used if at least one of mandatoryUpdateMessage or optionalUpdateMessage options are set. (string)
- __optionalInstallButtonLabel__: The label of the confirmation button in case of an optional update. (string)
- __optionalIgnoreButtonLabel__: The label of the cancel button in case of an optional update. (string)
- __mandatoryContinueButtonLabel__: The label of the continue button in case of a mandatory update. (string)
- __appendReleaseDescription__: Flag indicating if the update description provided by the CodePush server should be displayed in the dialog box appended to the update message. Defaults to false. (boolean)
- __descriptionPrefix__: Optional prefix to add to the release description. (string)
- __rollbackTimeout__: Optional time interval, in milliseconds, to wait for a [notifyApplicationReady()](#codepushnotifyapplicationready) call before marking the apply as failed and reverting to the previous version. Sync calls [notifyApplicationReady()](#codepushnotifyapplicationready) internally, so if you use sync() in your updated version of the application, there is no need to call [notifyApplicationReady()](#codepushnotifyapplicationready) again. By default, the rollback functionality is disabled - the parameter defaults to 0. (number)
- __ignoreFailedUpdates__: Optional boolean flag. If set, updates available on the server for which and update was attempted and rolled back will be ignored. Defaults to true. (boolean)

### Example
```javascript

// Using default sync options: user interaction is enabled

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
    
}, syncOptions);

```

# Cordova Plugin for CodePush

This plugin provides client-side integration for the [CodePush service](http://codepush.tools), allowing you to easily add a dynamic update experience to your Cordova app(s).

* [How does it work?](#how-does-it-work)
* [Supported Cordova Platforms](#supported-cordova-platforms)
* [Getting Started](#getting-started)
* [Plugin Usage](#plugin-usage)
* [Releasing Updates](#releasing-updates)
* [API Reference](#api-reference)

## How does it work?

A Cordova app is composed of HTML, CSS and JavaScript files and any accompanying images, which are bundled together by the Cordova CLI and distributed as part of a platform-specific binary (i.e. an .ipa or .apk file). Once the app is released, updating either the code (e.g. making bug fixes, adding new features) or image assets, requires you to recompile and redistribute the entire binary, which of course, includes any review time associated with the store(s) you are publishing to.

The CodePush plugin helps get product improvements in front of your end users instantly, by keeping your code and images synchronized with updates you release to the CodePush server. This way, your app gets the benefits of an offline mobile experience, as well as the "web-like" agility of side-loading updates as soon as they are available. It's a win-win!

In order to ensure that your end users always have a functioning version of your app, the CodePush plugin maintains a copy of the previous update, so that in the event that you accidentally push an update which includes a crash, it can automatically roll back. This way, you can rest assured that your newfound release agility won't result in users becoming blocked before you have a chance to roll back on the server. It's a win-win-win!

*Note: Any product changes which touch native code (e.g. upgrading Cordova versions, adding a new plugin) cannot be distributed via CodePush, and therefore, must be updated via the appropriate store(s).*

## Supported Cordova Platforms

Cordova 5.0.0+ is fully supported, along with the following asociated platforms:

* Android ([cordova-android](https://github.com/apache/cordova-android) 4.0.0+) - *Including CrossWalk!* 
* iOS ([cordova-ios](https://github.com/apache/cordova-ios) 3.9.0+) - *Note: In order to use CodePush along with the [`cordova-plugin-wkwebview-engine`](https://github.com/apache/cordova-plugin-wkwebview-engine) plugin, you need to install `v1.5.1-beta+`, which includes full support for apps using either WebView.*

To check which versions of each Cordova platform you are currently using, you can run the following command and inspect the `Installed platforms` list:

```shell
cordova platform ls
```

If you're running an older Android and/or iOS platform than is mentioned above, and would be open to upgrading, you can easily do so by running the following commands (omitting a platform if it isn't neccessary):

```shell
cordova platform update android
cordova platform update ios
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
    
    As a reminder, these keys are generated for you when you created your CodePush app via the CLI. If you need to retrieve them, you can simply run `code-push deployment ls APP_NAME -k`, and grab the key for the specific deployment you want to use (e.g. `Staging`, `Production`).
    
    *NOTE: We [recommend](http://microsoft.github.io/code-push/docs/cli.html#link-4) creating a seperate CodePush app for iOS and Android, which is why the above sample illustrates declaring seperate keys for Android and iOS. If you're only developing for a single platform, then you only need to specify the deployment key for either Android or iOS, so you don't need to add the additional `<platform>` element as illustrated above.*
    
2. If you're using an `<access origin="*" />` element in your `config.xml` file, then your app is already allowed to communicate with the CodePush servers and you can safely skip this step. Otherwise, add the following additional `<access />` elements:
 
    ```xml
    <access origin="https://codepush.azurewebsites.net" />
    <access origin="https://codepush.blob.core.windows.net" />
    ```
    
3. To ensure that your app can access the CodePush server on [CSP](https://developer.mozilla.org/en-US/docs/Web/Security/CSP/Introducing_Content_Security_Policy)-compliant platforms, add `https://codepush.azurewebsites.net` to the `Content-Security-Policy` `meta` tag in your `index.html` file:
  
    ```xml
    <meta http-equiv="Content-Security-Policy" content="default-src https://codepush.azurewebsites.net 'self' data: gap: https://ssl.gstatic.com 'unsafe-eval'; style-src 'self' 'unsafe-inline'; media-src *" />
    ```
   
4. Finally, double-check that you already have the [`cordova-plugin-whitelist`](https://github.com/apache/cordova-plugin-whitelist) plugin installed (most apps will). To check this, simply run the following command:

    ```shell
    cordova plugin ls
    ```
    
    If `cordova-plugin-whitelist` is in the list, then you are good to go. Otherwise, simply run the following command to add it:
    
    ```shell
    cordova plugin add cordova-plugin-whitelist
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

*NOTE: While [Apple's developer agreement](https://developer.apple.com/programs/ios/information/iOS_Program_Information_4_3_15.pdf) fully allows performing over-the-air updates of JavaScript and assets (which is what enables CodePush!), it is against their policy for an app to display an update prompt. Because of this, we recommend that App Store-distributed apps don't enable the `updateDialog` option when calling `sync`, whereas Google Play and internally distributed apps (e.g. Enterprise, Fabric, HockeyApp) can choose to enable/customize it.*

## Releasing Updates

Once your app has been configured and distributed to your users, and you've made some code and/or asset changes, it's time to instantly release them! The simplest (and recommended) way to do this is to use the `release-cordova` comand in the CodePush CLI, which will handle preparing and releasing your update to the CodePush server. 

In it's most basic form, this command only requires two parameters: your app name and the platform you are creating the update for (either `ios` or `android`).

```shell
code-push release-cordova <appName> <platform>

code-push release-cordova MyApp-ios ios
code-push release-cordova MyApp-Android android
```

The `release-cordova` command enables such a simple workflow because it understands the standard layout of a Cordova app, and therefore, can generate your update and know exactly which files to upload. Additionally, in order to support flexible release strategies, the `release-cordova` command exposes numerous optional parameters that let you customize how the update should be distributed to your end users (e.g. Which binary versions are compatible with it? Should the release be viewed as mandatory?).  

```shell
# Release a mandatory update with a changelog
code-push release-cordova MyApp-ios ios -m --description "Modified the header color"

# Release a dev Android build to just 1/4 of your end users
code-push release-cordova MyApp-Android android --rollout 25%

# Release an update that targets users running any 1.1.* binary, as opposed to
# limiting the update to exact version name in the config.xml file
code-push release-cordova MyApp-Android android --targetBinaryVersion "~1.1.0"

# Release the update now but mark it as disabled
# so that no users can download it yet
code-push release-cordova MyApp-ios ios -x
```

The CodePush client supports differential updates, so even though you are releasing your app code on every update, your end users will only actually download the files they need. The service handles this automatically so that you can focus on creating awesome apps and we can worry about optimizing end user downloads.

For more details about how the `release-cordova` command works, as well as the various parameters it exposes, refer to the [CLI docs](https://github.com/Microsoft/code-push/tree/master/cli#releasing-updates-cordova). Additionally, if you would prefer to handle running the `cordova prepare` command yourself, and therefore, want an even more flexible solution than `release-cordova`, refer to the [`release` command](https://github.com/Microsoft/code-push/tree/master/cli#releasing-updates-general) for more details.

If you run into any issues, or have any questions/comments/feedback, you can [e-mail us](mailto:codepushfeed@microsoft.com) and/or open a new issue on this repo and we'll respond ASAP!

## API Reference

The CodePush API is exposed to your app via the global `codePush` object, which is available after the `deviceready` event fires. This API exposes the following top-level methods:

- __[checkForUpdate](#codepushcheckforupdate)__: Asks the CodePush service whether the configured app deployment has an update available.

- __[getCurrentPackage](#codepushgetcurrentpackage)__: Retrieves the metadata about the currently installed update (e.g. description, installation time, size).

- __[notifyApplicationReady](#codepushnotifyapplicationready)__: Notifies the CodePush runtime that an installed update is considered successful. If you are manually checking for and installing updates (i.e. not using the sync method to handle it all for you), then this method **MUST** be called; otherwise CodePush will treat the update as failed and rollback to the previous version when the app next restarts.

- __[restartApplication](#codepushrestartapplication)__: Immediately restarts the app. If there is an update pending, it will be immediately displayed to the end user.

- __[sync](#codepushsync)__: Allows checking for an update, downloading it and installing it, all with a single call. Unless you need custom UI and/or behavior, we recommend most developers to use this method when integrating CodePush into their apps.

Additionally, the following objects and enums are also exposed globally as part of the CodePush API:

- __[InstallMode](#installmode)__: Defines the available install modes for updates.
- __[LocalPackage](#localpackage)__: Contains information about a locally installed package.
- __[RemotePackage](#remotepackage)__: Contains information about an update package available for download.
- __[SyncStatus](#syncstatus)__: Defines the possible intermediate and result statuses of the [sync](#codepushsync) operation.

### codePush.checkForUpdate

```javascript
codePush.checkForUpdate(onUpdateCheck, onError?, deploymentKey?: String);
```

Queries the CodePush service to see whether the configured app deployment has an update available. By default, it will use the deployment key that is configured in your `config.xml` file, but you can override that by specifying a value via the optional `deploymentKey` parameter. This can be useful when you want to dynamically "redirect" a user to a specific deployment, such as allowing "Early access" via an easter egg or a user setting switch.

When the update check completes, it will trigger the `onUpdateCheck` callback with one of two possible values:

1. `null` if there is no update available. This occurs in the following scenarios:

    1. The configured deployment doesn't contain any releases, and therefore, nothing to update.
    
    2. The latest release within the configured deployment is targeting a different binary version than what you're currently running (either older or newer).

    3. The currently running app already has the latest release from the configured deployment, and therefore, doesn't need it again.

2. A `RemotePackage` instance which represents an available update that can be inspected and/or subsequently downloaded.

Parameters:

- __onUpdateCheck__: Callback that is invoked upon receiving a successful response from the server. The callback receives a single parameter, which is described above.

- __onError__: Optional callback that is invoked in the event of an error. The callback takes one error parameter, containing the details of the error.

- __deploymentKey__: Optional deployment key that overrides the `config.xml` setting.

Example usage:

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
codePush.getCurrentPackage(onPackageSuccess, onError?);
```

Retrieves the metadata about the currently installed "package" (e.g. description, installation time). This can be useful for scenarios such as displaying a "what's new?" dialog after an update has been applied or checking whether there is a pending update that is waiting to be applied via a resume or restart.

When the update retrieval completes, it will trigger the `onPackageSuccess` callback with one of two possible values:

1. `null` if the app is currently running the HTML start page from the binary and not a CodePush update. This occurs in the following scenarios:

    1. The end-user installed the app binary and has yet to install a CodePush update
    
    2. The end-user installed an update of the binary (e.g. from the store), which cleared away the old CodePush updates, and gave precedence back to the binary.
    
2. A `LocalPackage` instance which represents the metadata for the currently running CodePush update.

Parameters:

- __onPackageSuccess__: Callback that is invoked upon receiving the metadata about the currently running update. The callback receives a single parameter, which is described above.

- __onError__: Optional callback that is invoked in the event of an error. The callback takes one error parameter, containing the details of the error.

Example Usage:

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
codePush.notifyApplicationReady(notifySucceeded?, notifyFailed?);
```

Notifies the CodePush runtime that a freshly installed update should be considered successful, and therefore, an automatic client-side rollback isn't necessary. It is mandatory to call this function somewhere in the code of the updated bundle. Otherwise, when the app next restarts, the CodePush runtime will assume that the installed update has failed and roll back to the previous version. This behavior exists to help ensure that your end users aren't blocked by a broken update.

If you are using the `sync` function, and doing your update check on app start, then you don't need to manually call `notifyApplicationReady` since `sync` will call it for you. This behavior exists due to the assumption that the point at which `sync` is called in your app represents a good approximation of a successful startup.

Parameters:

- __notifySucceeded__: Optional callback invoked if the plugin was successfully notified.

- __notifyFailed__: Optional callback invoked in case of an error during notifying the plugin.

Example Usage:

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

### codePush.restartApplication

```javascript
codePush.restartApplication();
```

Immediately restarts the app. This method is for advanced scenarios, and is primarily useful when the following conditions are true:

1. Your app is specifying an install mode value of `ON_NEXT_RESTART` or `ON_NEXT_RESUME` when calling the `sync` or `LocalPackage.install` methods. This has the effect of not applying your update until the app has been restarted (by either the end user or OS) or resumed, and therefore, the update won't be immediately displayed to the end user.

2. You have an app-specific user event (e.g. the end user navigated back to the app's home route) that allows you to apply the update in an unobtrusive way, and potentially gets the update in front of the end user sooner then waiting until the next restart or resume.

### codePush.sync

```javascript
codePush.sync(syncCallback?, syncOptions?, downloadProgress?);
```

Synchronizes your app's code and images with the latest release to the configured deployment. Unlike the `checkForUpdate` method, which simply checks for the presence of an update, and let's you control what to do next, `sync` handles the update check, download and installation experience for you.

This method provides support for two different (but customizable) "modes" to easily enable apps with different requirements:

1. **Silent mode** *(the default behavior)*, which automatically downloads available updates, and applies them the next time the app restarts (e.g. the OS or end user killed it, or the device was restarted). This way, the entire update experience is "silent" to the end user, since they don't see any update prompt and/or "synthetic" app restarts.

2. **Active mode**, which when an update is available, prompts the end user for permission before downloading it, and then immediately applies the update. If an update was released using the mandatory flag, the end user would still be notified about the update, but they wouldn't have the choice to ignore it.

Note that regardless whether you choose to display an update dialog, whenever an available update is discovered, that is marked as mandatory, it will be installed immediately after downloading it. This way, developers have the ability to enforce critical updates as neccessary, regardless what kind of UI they chose to implement. If the update dialog is being displayed, the end user will be notified about the update, but want be able to ignore it.

Parameters:

- __syncCallback__: Optional callback to be called with the status of the sync operation. The callback will be called multiple times. It will be called at least one time with an intermediate status, and only one time (the final call) with a result status. The possible statuses are defined by the `SyncStatus` enum.

- __syncOptions__: Optional `SyncOptions` parameter configuring the behavior of the sync operation.

- __downloadProgress__: Optional callback invoked during the download process. It is called several times with one `DownloadProgress` parameter.

#### SyncOptions

While the `sync` method tries to make it easy to perform silent and active updates with little configuration, it accepts an "options" object that allows you to customize numerous aspects of the default behavior mentioned above:

- __deploymentKey__ *(String)* - Option used to override the config.xml deployment key when checking for updates. Defaults to `undefined`.

- __installMode__ *(InstallMode)* - Used to specify the [InstallMode](#installmode) used for the install operation. Defaults to `InstallMode.ON_NEXT_RESTART`.

- __ignoreFailedUpdates__ *(Boolean)* - Optional boolean flag. If set, updates available on the server for which and update was attempted and rolled back will be ignored. Defaults to `true`.

- __updateDialog__ *(UpdateDialogOptions)* - Option used to enable, disable or customize the user interaction during sync. If set to false, user interaction will be disabled. If set to true, the user will be alerted or asked to confirm new updates, based on whether the update is mandatory. To customize the user dialog, this option can be set to a custom `UpdateDialogOptions` instance. Defaults to `false.

##### UpdateDialogOptions

Interface defining the configuration options for the alert or confirmation dialog.

- __appendReleaseDescription__ *(Boolean)* - Flag indicating if the update description provided by the CodePush server should be displayed in the dialog box appended to the update message. Defaults to `false`.

- __descriptionPrefix__ *(String)* - Optional prefix to add to the release description. Defaults to `" Description: "`.

- __mandatoryContinueButtonLabel__ *(String)*: The label of the continue button in case of a mandatory update. Defaults to `"Continue"`.

- __mandatoryUpdateMessage__ *(String)* - If a mandatory update is available and this option is set, the message will be displayed to the user in an alert dialog before downloading and installing the update. The user will not be able to cancel the operation, since the update is mandatory. Defaults to `"An update is available that must be installed."`.

- __optionalIgnoreButtonLabel__ *(String)* - The label of the cancel button in case of an optional update. Defaults to `"Ignore"`.

- __optionalInstallButtonLabel__ *(String)* - The label of the confirmation button in case of an optional update. Defaults to `"Install"`.

- __optionalUpdateMessage__ *(String)* - If an optional update is available and this option is set, the message will be displayed to the user in a confirmation dialog. If the user confirms the update, it will be downloaded and installed. Otherwise, the update update is not downloaded. Defaults to `"An update is available. Would you like to install it?"`.

- __updateTitle__ *(String)* - The title of the dialog box used for interacting with the user in case of a mandatory or optional update. This title will only be used if at least one of mandatoryUpdateMessage or optionalUpdateMessage options are set. Defaults to `"Update available"`.

Example Usage:

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

The `checkForUpdate` and `getCurrentPackage` methods invoke success callbacks, that when triggered, provide acces to "package" objects. The package represents your code update as well as any extra metadata (e.g. description, mandatory?). The CodePush API has the distinction between the following types of packages:

1. `LocalPackage`: Represents a downloaded update that is either already running, or has been installed and is pending an app restart.

2. `RemotePackage`: Represents an available update on the CodePush server that hasn't been downloaded yet.

#### LocalPackage

Contains details about an update that has been downloaded locally or already installed. You can get a reference to an instance of this object either by calling the `codePush.getCurrentPackage` method, or as the value provided to the success callback of the `RemotePackage.download` method.

##### Properties

- __appVersion__: The native version of the application this package update is intended for. *(String)*
- __deploymentKey__: Deployment key of the package. *(String)*
- __description__: The description of the update. This is the same value that you specified in the CLI when you released the update. *(String)*
- __failedInstall__: Indicates whether this update has been previously installed but was rolled back. The `sync` method will automatically ignore updates which have previously failed, so you only need to worry about this property if using `checkForUpdate`. *(Boolean)*
- __isFirstRun__: Flag indicating if the current application run is the first one after the package was applied. *(Boolean)*
- __isMandatory__: Indicates whether the update is considered mandatory. This is the value that was specified in the CLI when the update was released. *(Boolean)*
- __label__: The internal label automatically given to the update by the CodePush server. This value uniquely identifies the update within it's deployment. *(String)*
- __packageHash__: The SHA hash value of the update. *(String)*
- __packageSize__: The size of the code contained within the update, in bytes. *(Number)*

##### Methods

- __install(installSuccess, installError, installOptions)__: Installs this package to the application.
The install behavior is dependent on the provided `installOptions`. By default, the update package is silently installed and the application is reloaded with the new content on the next application start.
On the first run after the update, the application will wait for a `codePush.notifyApplicationReady()` call. Once this call is made, the install operation is considered a success.
Otherwise, the install operation will be marked as failed, and the application is reverted to its previous version on the next run.

    ###### InstallOptions

    Interface defining several options for customizing install operation behavior.

    - __installMode__: Used to specify the [InstallMode](#installmode) used for the install operation. Defaults `InstallMode.ON_NEXT_RESTART`.

Example Usage:

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

Contains details about an update that is available for download from the CodePush server. You get a reference to an instance of this object by calling the `codePush.checkForUpdate` method when an update is available. If you are using the sync API, you don't need to worry about the `RemotePackage`, since it will handle the download and installation process automatically for you.

##### Properties

The `RemotePackage` inherits all of the same properties as the `LocalPackage`, but includes one additional one:

- __downloadUrl__: The URL at which the package is available for download. This property is only needed for advanced usage, since the `download` method will automatically handle the acquisition of updates for you. *(String)*

##### Methods

- __abortDownload(abortSuccess, abortError)__: Aborts the current download session, if any.

- __download(downloadSuccess, downloadError, downloadProgress)__: Downloads the package update from the CodePush service. The ```downloadSuccess``` callback is invoked with a [LocalPackage](#localpackage) argument, representing the downloaded package.
The optional `downloadProgress` callback is invoked several times during the download progress with one `DownloadProgress` parameter.

    ###### DownloadProgress

    Defines the format of the DownloadProgress object, used to send periodical update notifications on the progress of the update download.

    ####### Properties

    - __totalBytes__: The size of the downloading update package, in bytes. (Number)
    - __receivedBytes__: The number of bytes already downloaded. (Number)

Example Usage:

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

This enum specified when you would like an installed update to actually be applied, and can be passed to either the `sync` or `LocalPackage.install` methods. It includes the following values:

- __IMMEDIATE__: The update will be applied to the running application immediately. The application will be reloaded with the new content immediately.

- __ON_NEXT_RESTART__: Indicates that you want to install the update, but not forcibly restart the app. When the app is "naturally" restarted (due the OS or end user killing it), the update will be seamlessly picked up. This value is appropriate when performing silent updates, since it would likely be disruptive to the end user if the app suddenly restarted out of nowhere, since they wouldn't have realized an update was even downloaded. This is the default mode used for both the `sync` and `LocalPackage.install` methods.

- __ON_NEXT_RESUME__: Indicates that you want to install the update, but don't want to restart the app until the next time the end user resumes it from the background. This way, you don't disrupt their current session, but you can get the update in front of them sooner then having to wait for the next natural restart. This value is appropriate for silent installs that can be applied on resume in a non-invasive way.

#### SyncStatus

Defines the possible statuses of the [sync](#codepushsync) operation. There are two categories of statuses: intermediate and result (final). The intermediate statuses represent progress statuses of the sync operation, and are not final. The result statuses represent final statuses of the sync operation. Every sync operation ends with only one result status, but can have zero or more intermediate statuses.

- __UP_TO_DATE__: The app is fully up-to-date with the configured deployment.

- __UPDATE_INSTALLED__: An available update has been installed and will be run either immediately after the callback function returns or the next time the app resumes/restarts, depending on the `InstallMode` specified in `SyncOptions`.

- __UPDATE_IGNORED__: The app has an optional update, which the end user chose to ignore. *(This is only applicable when the `updateDialog` is used)*
 
- __ERROR__: An error occured during the `sync` operation. This might be an error while communicating with the server, downloading or unziping the update. The console logs should contain more information about what happened. No update has been applied in this case.

- __CHECKING_FOR_UPDATE__: The CodePush server is being queried for an update.

- __AWAITING_USER_ACTION__: An update is available, and a confirmation dialog was shown to the end user. *(This is only applicable when the `updateDialog` is used)*

- __DOWNLOADING_PACKAGE__: An available update is being downloaded from the CodePush server.

- __INSTALLING_UPDATE__: An available update was downloaded and is about to be installed.

## Compiling sources & contributing

The JavaScript code in this plugin is compiled from TypeScript. Please see [this page](CONTRIBUTING.md) for more details on contributing and how to build the project.

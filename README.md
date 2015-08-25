# cordova-plugin-code-push

This plugin provides easy integration with the Code Push service, allowing you to update your Cordova application outside the application stores.

Access to the plugin is through the ```navigator.codePush``` object.

## Installation


	cordova plugin add cordova-plugin-code-push


## Supported platforms

- Android
- iOS

## Compiling sources & contributing

The JavaScript code in this plugin is compiled from TypeScript. Please see [this page](CONTRIBUTING.MD) for more details on contributing and how to build the project.

## Methods
- __[queryUpdate](#navigatorcodepushqueryupdate)__: Queries the server for update packages.
- __[download](#navigatorcodepushdownload)__: Downloads an update package from the server.
- __[abortDownload](#navigatorcodepushabortdownload)__: Aborts the current download session. 
- __[apply](#navigatorcodepushapply)__: Applies a downloaded update package.
- __[applyWithRevertProtection](#navigatorcodepushapplywithrevertprotection)__: Applies a downloaded update package with revert protection. This enables the application to revert to the previous version in case something goes wrong with the update.
- __[updateSucceeded](#navigatorcodepushupdatesucceeded)__: Notifies the plugin that the update operation succeeded.
- __[hasUpdatePreviouslyFailed](#navigatorcodepushhasupdatepreviouslyfailed)__: Checks if a package update was previously attempted but failed for a given update package hash.
- __[getCurrentPackage](#navigatorcodepushgetcurrentpackage)__: Gets information about the currently applied package.
- __[didUpdate](#navigatorcodepushdidupdate)__: Verifies if this is the first run after an application update.

## Interfaces
- __[LocalPackage](#localpackage)__: Contains information about a locally installed package.
- __[RemotePackage](#remotepackage)__: Contains information about an update package available for download.

## Getting started
- Add the plugin to your application.
- Add the configuration preferences to your ```config.xml```
```xml
    <platform name="android">
        <preference name="CodePushDeploymentKey" value="YOUR-ANDROID-DEPLOYMENT-KEY" />
    </platform>
    <platform name="ios">
        <preference name="CodePushDeploymentKey" value="YOUR-IOS-DEPLOYMENT-KEY" />
    </platform>
    <preference name="CodePushServerURL" value="HTTP(S)://YOUR-CODE-PUSH-SERVER-URL" />
```
- Allow access to the Code Push server:
  - In ```config.xml```, add 
  ```xml
  <access origin="HTTP(S)://YOUR-CODE-PUSH-SERVER-URL" />
  ```
  - In your html pages where the plugin is used, add the server URL to your existing Content Security Policy (CSP) header:
  ```xml
  <meta http-equiv="Content-Security-Policy" content="default-src HTTP(S)://YOUR-CODE-PUSH-SERVER-URL 'self' ... ">
   ```
- You are now ready to use the plugin in the application code. See the sample app for an example and the methods description for more details.

## Create an application update package
You can create an update by simply zipping your platform's www folder:
- Build your application.
- For Android:
  - The platform ```www``` folder is located at: ``` path_to_your_application/platform/android/assets/www```
  - Right click the folder and create a zip archive from it.
  - Upload the archive to your Android specific deployment using the Code Push CLI.
- For iOS:
  - The platform ```www``` folder is located at: ```path_to_your_application/platform/ios/www```
  - Right click the folder and create a zip archive from it.
  - Upload the archive to you iOS specific deployment using the Code Push CLI.

The service should now return an update when calling ```navigator.codePush.queryUpdate```.

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
- __localPath__: The current, local path of the package. (String)

## RemotePackage
Contains details about an update package that is ready to be downloaded. This object contains very similar properties to ```LocalPackage```, with the difference that it has a ```downloadUrl``` property instead of the local path property.
### Properties
- __deploymentKey__: Deployment key of the package. (String)
- __description__: Package description. (String)
- __label__: Package label. (String)
- __appVersion__: The native version of the application this package update is intended for. (String)
- __isMandatory__: Flag indicating if the update is mandatory. (Boolean)
- __packageHash__: The hash value of the package. (String)
- __packageSize__: The size of the package, in bytes. (Number)
- __downloadUrl__: The URL at which the package is available for download. (String)

## navigator.codePush.queryUpdate
Queries the Code Push server for updates.
```javascript
navigator.codePush.queryUpdate(querySuccess, queryError);
```
- __querySuccess__ Callback invoked in case of a successful response from the server.
                          The callback takes one ```RemotePackage``` parameter. A non-null package is a valid update.
                         A null package means the application is up to date.
- __queryError__ Optional callback invoked in case of an error. The callback takes one error parameter, containing the details of the error.


## navigator.codePush.download
```javascript
navigator.codePush.download(package, downloadSuccess, downloadError);
```
Downloads a package update from the Code Push service.
     
- __package__: The ```RemotePackage``` to download.
- __downloadSuccess__: Callback function invoked with one ```LocalPackage``` parameter, the downloaded package information, once the download completed successfully.
- __downloadError__: Optional callback invoked in case of an error.

## navigator.codePush.abortDownload
```javascript
navigator.codePush.abortDownload(abortSuccess, abortError)
```
Aborts the current download session, previously started with download().
- __abortSuccess__: Optional callback invoked if the abort operation succeeded.
- __abortError__: Optional callback invoked in case of an error.


## navigator.codePush.applyWithRevertProtection
```javascript
navigator.codePush.applyWithRevertProtection(newPackage, applySuccessTimeoutMillis, applySuccess, applyError);
``` 
Applies a downloaded package with revert protection.

__Important: If the ```navigator.codePush.updateSucceeded``` method is not invoked in the time specified by applySuccessTimeoutMillis, the application will be reverted to its previous version.__
- __newPackage__: The package update to apply.
- __updateSucceededTimeoutMillis__: The milliseconds interval to wait for a ```navigator.codePush.updateSucceeded``` call. If in the given interval a call to ```navigator.codePush.updateSucceeded``` has not been received, the application is reverted to its previous version.
- __updateSucceeded__: Callback invoked if the apply operation succeeded. This is the last callback to be invoked after the javascript context is reloaded in the application by launching the updated application. Invocation of this callback does not guarantee that the application will not be reverted, since it is invoked before the applySuccessTimeoutMillis countdown starts.
- __applyError__: Optional callback invoked in case of an error.

## navigator.codePush.apply
```javascript
navigator.codePush.apply(newPackage, applySuccess, applyError);
```
Applies a downloaded package.
- __newPackage__: The ```LocalPackage``` update to apply.
- __applySuccess__: Callback invoked if the apply operation succeeded. 
- __applyError__: Optional callback invoked in case of an error.

## navigator.codePush.updateSucceeded
```javascript
navigator.codePush.updateSucceeded(notifySucceeded, notifyFailed);
```
Notifies the plugin that the update operation succeeded.
Calling this function is required if ```navigator.codePush.applyWithRevertProtection``` is used for your update.
If ```navigator.codePush.apply``` was used for the update instead, calling this function is not required and will result in a noop.
- __notifySucceeded__: Optional callback invoked if the plugin was successfully notified.
- __notifyFailed__: Optional callback invoked in case of an error during notifying the plugin.


## navigator.codePush.hasUpdatePreviouslyFailed
```javascript
navigator.codePush.hasUpdatePreviouslyFailed(packageHash, checkSucceeded, checkFailed);
```
Checks if a package update was previously attempted but failed for a given package hash.
Every reverted update attempted with applyWithRevertProtection() is stored such that the application developer has the option to ignore updates that previously failed. This way, an infinite update loop can be prevented in case of a bad update package.
- __packageHash__: String hash of the package update to check.
- __checkSucceeded__: Callback taking one boolean parameter invoked with the result of the check.
- __checkFailed__: Optional callback invoked in case of an error.


## navigator.codePush.getCurrentPackage
```javascript
navigator.codePush.getCurrentPackage(packageSuccess, packageError);
```
Get the currently installed package information. 
- __packageSuccess__: Callback invoked with the currently deployed package information.
- __packageError__: Optional callback invoked in case of an error.

## navigator.codePush.didUpdate
```javascript
navigator.codePush.didUpdate(didUpdateCallback);
```
Checks if this is the first application run after an update has been applied.
- __didUpdateCallback__: Result callback invoked with three parameters:
                         - A boolean parameter indicating if this is the first run after an update.
                         - A ```LocalPackage``` parameter containing the old package information, if this is the first run after an update. Otherwise, it is null.
                         - A ```LocalPackage``` parameter containing the current package information, if this is the first run after an update. Otherwise, it is null.
# cordova-plugin-code-push

This plugin provides integration with the CodePush service, allowing you to easily update your Cordova application.

Access to the plugin is through the ```window.codePush``` object. The object is available after the ```deviceready``` event.

## Installation


	cordova plugin add cordova-plugin-code-push


## Supported platforms

- Android
- iOS

## Compiling sources & contributing

The JavaScript code in this plugin is compiled from TypeScript. Please see [this page](CONTRIBUTING.md) for more details on contributing and how to build the project.

## Methods
- __[checkForUpdate](#codepushcheckforupdate)__: Checks the server for update packages.
- __[notifyApplicationReady](#codepushnotifyapplicationready)__: Notifies the plugin that the update operation succeeded.
- __[getCurrentPackage](#codepushgetcurrentpackage)__: Gets information about the currently applied package.

## Objects
- __[LocalPackage](#localpackage)__: Contains information about a locally installed package.
- __[RemotePackage](#remotepackage)__: Contains information about an update package available for download.

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
- Allow access to the Code Push server:
  - In ```config.xml```, add 
  ```xml
  <access origin="https://codepush.azurewebsites.net/ " />
  ```
  - In your html pages where the plugin is used, add the server URL to your existing Content Security Policy (CSP) header:
  ```xml
  <meta http-equiv="Content-Security-Policy" content="default-src https://codepush.azurewebsites.net/ 'self' ... ">
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
- __failedApply__: Boolean version indicating if this update package was previously attempted and the update failed. (Boolean)
- __localPath__: The current, local path of the package. (String)
- __isFirstRun__: Flag indicating if the current application run is the first one after the package was applied. (Boolean)

### Methods
- __apply(applySuccess, applyError, rollbackTimeout)__: Applies this package to the application. The application will be reloaded with this package and on every application launch this package will be loaded.
If the rollbackTimeout parameter is provided, the application will wait for a codePush.notifyApplicationReady() for the given number of milliseconds.
If codePush.notifyApplicationReady() is called before the time period specified by rollbackTimeout, the apply operation is considered a success.
Otherwise, the apply operation will be marked as failed, and the application is reverted to its previous version.

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
- __failedApply__: Boolean version indicating if this update package was previously attempted and the update failed. (Boolean)
- __downloadUrl__: The URL at which the package is available for download. (String)

### Methods
- __download(downloadSuccess, downloadError)__: Downloads the package update from the Code Push service. The ```downloadSuccess``` callback is invoked with a ```LocalPackage``` argument, representing the downloaded package.
- __abortDownload(abortSuccess, abortError)__: Aborts the current download session, if any.

## codePush.checkForUpdate
Queries the Code Push server for updates.
```javascript
codePush.checkForUpdate(updateSuccess, updateError);
```
- __updateSuccess__ Callback invoked in case of a successful response from the server.
                          The callback takes one ```RemotePackage``` parameter. A non-null package is a valid update.
                         A null package means the application is up to date.
- __updateError__ Optional callback invoked in case of an error. The callback takes one error parameter, containing the details of the error.

## codePush.getCurrentPackage
```javascript
codePush.getCurrentPackage(packageSuccess, packageError);
```
Get the currently installed package information. 
- __packageSuccess__: Callback invoked with the currently deployed package information. If the application did not install updates yet, ```packageSuccess``` will be called with a ```null``` argument.
- __packageError__: Optional callback invoked in case of an error.

## codePush.notifyApplicationReady
```javascript
codePush.notifyApplicationReady(notifySucceeded, notifyFailed);
```
Notifies the plugin that the update operation succeeded.
Calling this function is required if a rollbackTimeout parameter is passed to your ```LocalPackage.apply``` call.
If automatic rollback was not used, calling this function is not required and will result in a noop.
- __notifySucceeded__: Optional callback invoked if the plugin was successfully notified.
- __notifyFailed__: Optional callback invoked in case of an error during notifying the plugin.

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
    <preference name="CodePushServer" value="HTTP://YOUR-CODE-PUSH-SERVER-URL" />
	```
- Allow access to the Code Push server:
  - In ```config.xml```, add 
     ```xml
     <access origin="HTTP://YOUR-CODE-PUSH-SERVER-URL" />
     ```
  - In your html pages where the plugin is used, add the server URL to your existing Content Security Policy (CSP) header:
  	```xml
    <meta http-equiv="Content-Security-Policy" content="default-src HTTP://YOUR-CODE-PUSH-SERVER-URL 'self' ... ">
    ```
- You are now ready to use the plugin in the application code. See the sample app for an example and the methods description for more details.

## Create an application update package
You can create an update by simply zipping your platform's www folder:
- Build your application.
- For Android:
  - The platform ```www``` folder is located at: ``` path_to_your_application/platform/android/assets/www```
  - Right click the folder and create a zip archive from it.
  - Upload the archive to your Android specific deployment in the Code Push service dashboard.
- For iOS:
  - The platform ```www``` folder is located at: ```path_to_your_application/platform/ios/www```
  - Right click the folder and create a zip archive from it.
  - Upload the archive to you iOS specific deployment in the Code Push service dashboard.

The service should now return an update when calling ```navigator.codePush.queryUpdate```.

## queryUpdate(querySuccess, queryError)

## download(package, downloadSuccess, downloadError)
    
## abortDownload(abortSuccess, abortError)
    
## applyWithRevertProtection(newPackage, applySuccessTimeoutMillis, applySuccess, applyError)
    
## apply(newPackage, applySuccess, applyError)
    
## updateSuccess(notifySucceeded, notifyFailed)
    
## updatePreviouslyFailed(packageHash, checkSucceeded, checkFailed)
    
## getCurrentPackage(packageSuccess, packageError)

# Contributing

## TypeScript

All the JS code in this plugin is compiled from TypeScript sources. Please do not submit pull requests with direct changes to the JS files in ```bin``` directory.
Instead, modify the sources in the ```www``` folder and compile a new version of the plugin. Read on for more details.

## Building the plugin

### Environment setup

```node.js``` and ```npm``` are needed for building this project. ```npm``` comes bundled with the ```node.js``` installer. You can download the ```node.js``` installer here: https://nodejs.org/download/. 

To run Android tests, make sure you have ```sdk\tools``` and  ```sdk\platform-tools``` in your PATH.

If you would like the tests to start the emulators for you, configure an Android emulator using the AVD and name it ```emulator```.
If you have the latest version of XCode installed, you should not have to configure anything.

### Compile

Follow these steps to build a new version of the plugin:
- clone this repository
- install the dependencies

	Navigate to the root folder from your command line console and run:
	```
	npm install
	```
- compile

	From the same root folder location, run:
	```
	gulp
	```
	This will compile the sources and place them in the ```bin``` folder. Any compilation errors will be displayed in the console.

### Test

The plugin has end to end tests for Android and iOS. Depending on your development machine OS, you can run some or all the tests.

OS            | Supported tests
------------- | -------------
OS X          | Android, iOS
Windows       | Android

The tests first build the app.

They then check if the required emulators are currently running. If running only Android tests, it checks for a running Android emulator, and if running only iOS tests, it checks for a running iOS simulator. If running both, it will check for both.
If they are not, then it attempts to start an Android emulator named ```emulator``` (if one exists) and an iOS simulator named ```iPhone 6s (9.3)```. If these emulators don't exist on your computer, the task will exit and the tests will fail. 
If you would like the tests to always restart the necessary emulators, add a ```-clean``` to the end of the command you'd like to run.

The desired unit tests are then run.
There is a both a full unit test suite and a "core" set of unit tests that you may run. If you would like to run only the core tests, add a ```-core``` to the end of the command you'd like to run.
If you would like to pull the plugin from NPM rather than running the tests on the local version, add a ```-npm``` to the end of the command you'd like to run.
If you would like to skip building and checking for emulators, add a ```-fast``` to the end of the command you'd like to run.

##### Default

To run all of the unit tests on Android and iOS with both UIWebView and WkWebView:
```
gulp test
```

##### iOS

To run all of the unit tests on iOS with both the UIWebView and WkWebView:
```
gulp test-ios
```

To run all of the unit tests on iOS with the UIWebView:
```
gulp test-ios-uiwebview
```

To run all of the unit tests on iOS with the WkWebView:
```
gulp test-ios-wkwebview
```

##### Android

To run all of the unit tests on Android:
```
gulp test-android
```

##### More examples

All possible testing configurations have tasks!
The flags should be ordered as following: android, ios, uiwebview, wkwebview, core, npm, fast, clean

To run the core unit tests on Android:
```
gulp test-android-core
```

To run all of the unit tests on iOS with the UIWebView and pull the plugin from NPM:
```
gulp test-ios-uiwebview-npm
```

To run all of the unit tests on Android and iOS with the UIWebView without building first:
```
gulp test-android-ios-uiwebview-fast
```

To run all of the unit tests on iOS with the WkWebView and restart the emulators:
```
gulp test-ios-wkwebview-clean
```

To run the core unit tests on Android and pull the plugin from NPM:
```
gulp test-android-core-npm
```

...and so on!
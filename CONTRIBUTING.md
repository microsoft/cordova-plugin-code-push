# Contributing

## TypeScript

All the JS code in this plugin is compiled from TypeScript sources. Please do not submit pull requests with direct changes to the JS files in ```bin``` directory.
Instead, modify the sources in the ```www``` folder and compile a new version of the plugin. Read on for more details.

## Building the plugin

### Environment setup

```node.js``` and ```npm``` are needed for building this project. ```npm``` comes bundled with the ```node.js``` installer. You can download the ```node.js``` installer here: https://nodejs.org/download/. 

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


##### iOS

To run the iOS tests:
```
gulp test-ios
```

##### Android

To run the Android tests, make sure you have your Android emulator running on the machine and the ADB in your path, and run:
```
gulp test-android
```

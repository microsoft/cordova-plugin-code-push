# Cordova CodePush Sample App - Advanced

This is a sample application demonstrating a more advanced way you could integrate CodePush in your Cordova application. All the CodePush specific code is found in [index.js](/samples/advanced/www/js/index.js). The CodePush configuration is found in [config.xml](/samples/advanced/config.xml).

When the application loads, on the `deviceready` event, we poll the CodePush server for an update. If an update is available, we prompt the user to install it. If the user approves it, the update is installed and the application is reloaded.

For more information on how to get started see our [Getting Started](/README.md#getting-started) section.

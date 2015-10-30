# Cordova CodePush Sample App - Basic

This is a sample application demonstrating the CodePush sync operation. This operation offers a very easy way of integrating CodePush in your application, by invoking only one function. All the CodePush specific code is found in [index.js](/samples/basic/www/js/index.js). The CodePush configuration is found in [config.xml](/samples/basic/config.xml).

When the application loads, on the `deviceready` event, we invoke sync. This checks for an update, and if one is available, the user will be prompted to install it. Once the user accepts it, the update is installed and the application reloaded. See [SyncOptions](/README.md#syncoptions) in our documentation for customizing the sync behavior. 

For more information on how to get started see our [Getting Started](/README.md#getting-started) section.

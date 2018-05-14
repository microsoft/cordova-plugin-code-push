module.exports = function (ctx) {
    var execSync = require('child_process').execSync;

    var cordovaCLI = "cordova";
    try {
        execSync(cordovaCLI);
    } catch (e) {
        try {
            cordovaCLI = "phonegap";
            execSync(cordovaCLI);
        } catch (e) {
            deferral.reject("An error occured. Please ensure that either the Cordova or PhoneGap CLI is installed.");
        }
    }

    var plugins = ctx.opts.cordova.plugins;

    if (plugins.indexOf("cordova-plugin-file") == -1) {
        console.log("Adding the cordova-plugin-file@4.3.3... ");
        var output = execSync(cordovaCLI + ' plugin add cordova-plugin-file@4.3.3').toString();
        console.log(output);
        plugins = execSync('cordova plugin').toString();
    }

    if (plugins.indexOf("cordova-plugin-file-transfer") == -1) {
        console.log("Adding the cordova-plugin-file-transfer@1.6.3... ");
        var output = execSync(cordovaCLI + ' plugin add cordova-plugin-file-transfer@1.6.3').toString();
        console.log(output);
        plugins = execSync('cordova plugin').toString();
    }

    if (plugins.indexOf("cordova-plugin-zip") == -1) {
        console.log("Adding the cordova-plugin-zip@3.1.0... ");
        var output = execSync(cordovaCLI + ' plugin add cordova-plugin-zip@3.1.0').toString();
        console.log(output);
    }
};
module.exports = function (ctx) {
    var execSync = require('child_process').execSync;
    var Q = ctx.requireCordovaModule('q');
    var deferral = new Q.defer();

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

    console.log("Detecting cordova version...");
    var cordovaVersion = ctx.opts.cordova.version;
    console.log("Cordova version is " + cordovaVersion);

    var plugins = execSync(cordovaCLI + ' plugin ls');
    if (!plugins.includes('cordova-plugin-file-transfer')) {
        if (parseFloat(cordovaVersion) < 6.3) {
            if (!plugins.includes('cordova-plugin-file')) {
                console.log("Installing the compatible version of file plugin... ");
                execSync(cordovaCLI + ' plugin add cordova-plugin-file@3.0.0');
            }
            console.log("Installing the compatible version of file transfer plugin... ");
            execSync(cordovaCLI + ' plugin add cordova-plugin-file-transfer@1.4.0');
        } else {
            try {
                console.log("Installing the latest version of file-transfer plugin... ");
                execSync(cordovaCLI + ' plugin add cordova-plugin-file-transfer@latest');
            } catch (e) {
                console.log('The version of file plugin appears to be incompatible with the latest file transfer version. Installing compatible version of file transfer.... ');
                execSync(cordovaCLI + ' plugin add cordova-plugin-file-transfer@1.4.0');
            }
        }
    }
    if (!plugins.includes('cordova-plugin-zip')) {
        execSync(cordovaCLI + ' plugin add cordova-plugin-zip');
    }
    deferral.resolve();

    return deferral.promise;
};
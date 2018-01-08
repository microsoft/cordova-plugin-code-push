module.exports = function(ctx) {
    var exec = require('child_process').execSync;
    var Q = ctx.requireCordovaModule('q');
    var deferral = new Q.defer();

    console.log("Detecting cordova version...");
    var cordovaV = ctx.opts.cordova.version;    
    console.log("Cordova version is " + cordovaV);

    var plugins = exec('cordova plugin ls');
    if (plugins.includes('cordova-plugin-file-transfer')) {
        console.log("Removing file transfer plugin to ensure cordova compatibility... ");    
        exec('cordova plugin remove cordova-plugin-file-transfer');
    }
    plugins = exec('cordova plugin ls');
    if (plugins.includes('cordova-plugin-file')) {
        console.log("Removing file plugin to ensure cordova compatibility... ");
        exec('cordova plugin remove cordova-plugin-file');
    }
    if (parseFloat(cordovaV) < 6.3) {
        console.log("Installing the compatible version of file-transfer plugin... ");
        exec('cordova plugin add cordova-plugin-file-transfer@1.6.3');
    } else {
        console.log("Installing the latest version of file-transfer plugin... ");
        exec('cordova plugin add cordova-plugin-file-transfer@latest');
    }
    deferral.resolve();

    return deferral.promise;
};
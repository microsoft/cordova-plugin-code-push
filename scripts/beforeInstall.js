module.exports = function(ctx) {
    var exec = require('child_process').exec;
    var Q = ctx.requireCordovaModule('q');
    var deferral = new Q.defer();
    
    console.log("Detecting cordova version...");
    var cordovaV = ctx.opts.cordova.version;

    console.log("Cordova version is " + cordovaV);
    console.log("Removing file plugin to ensure cordova compatibility...");
    exec('cordova plugin remove cordova-plugin-file');
    if (parseFloat(cordovaV) < 6.3) {
        exec('cordova plugin add cordova-plugin-file-transfer@1.6.3');
    } else {
        exec('cordova plugin add cordova-plugin-file-transfer@latest');
    }
    deferral.resolve();

    return deferral.promise;
};
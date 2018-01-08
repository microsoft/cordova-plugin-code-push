module.exports = function (ctx) {
	var exec = require('child_process').execSync;
	var Q = ctx.requireCordovaModule('q');
	var deferral = new Q.defer();

	console.log("Detecting cordova version...");
	var cordovaV = ctx.opts.cordova.version;
	console.log("Cordova version is " + cordovaV);

	var plugins = exec('cordova plugin ls');
	if (!plugins.includes('cordova-plugin-file-transfer')) {
		if (parseFloat(cordovaV) < 6.3) {
			if (!plugins.includes('cordova-plugin-file')) {
				console.log("Installing the compatible version of file plugin... ");
				exec('cordova plugin add cordova-plugin-file@3.0.0');
			}
			console.log("Installing the compatible version of file transfer plugin... ");
			exec('cordova plugin add cordova-plugin-file-transfer@1.4.0');
		} else {
			console.log("Installing the latest version of file-transfer plugin... ");
			exec('cordova plugin add cordova-plugin-file-transfer@latest');
		}
	}
	if (!plugins.includes('cordova-plugin-zip')) {
		exec('cordova plugin add cordova-plugin-zip');
	}
	deferral.resolve();

	return deferral.promise;
};
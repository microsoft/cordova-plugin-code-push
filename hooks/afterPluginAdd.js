module.exports = function (ctx) {
    if (ctx.cmdLine.includes("cordova-plugin-code-push")) {
        console.log("Starting hook afterPluginAdd.js of corodva-plugin-code-push...");
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
        console.log("Using " + cordovaCLI + " CLI for adding plugins...");
        
        var plugins = ctx.opts.cordova.plugins;

        if (!plugins.includes("cordova-plugin-file")) {
            console.log("Adding the cordova-plugin-file@4.3.3... ");
            var output = execSync(cordovaCLI + ' plugin add cordova-plugin-file@4.3.3').toString();
            console.log(output);
        }

        if (!plugins.includes("cordova-plugin-file-transfer")) {
            console.log("Adding the cordova-plugin-file-transfer@1.6.3... ");
            var output = execSync(cordovaCLI + ' plugin add cordova-plugin-file-transfer@1.6.3').toString();
            console.log(output);
        }

        if (!plugins.includes("cordova-plugin-zip")) {
            console.log("Adding the cordova-plugin-zip@3.1.0... ");
            var output = execSync(cordovaCLI + ' plugin add cordova-plugin-zip@3.1.0').toString();
            console.log(output);
        }

        console.log("Finished hook afterPluginAdd.js of corodva-plugin-code-push.");
    }
};
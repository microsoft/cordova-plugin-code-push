module.exports = function (ctx) {
    var execSync = require('child_process').execSync;

    var localNodeMudulePreCommand = "$(npm bin)/";
    var hideOutput = " > /dev/null 2>&1";
    if (/^win/.test(process.platform)) {
        hideOutput = " >NUL 2>1";
        localNodeMudulePreCommand = "%CD%\\node_modules\\.bin\\";
    }

    var cordovaCLI = "cordova";
    try {
        // global cordova
        execSync(cordovaCLI + hideOutput);
    } catch (e) {
        try {
            // local cordova
            cordovaCLI = localNodeMudulePreCommand + 'cordova';
            execSync(cordovaCLI + hideOutput);
        } catch (e) {
            try {
                // global phonegap
                cordovaCLI = "phonegap";
                execSync(cordovaCLI + hideOutput);
            } catch (e) {
                try {
                    // local phonegap
                    cordovaCLI = localNodeMudulePreCommand + "phonegap";
                    execSync(cordovaCLI + hideOutput);
                } catch (e) {
                    console.error('An error occured. Please ensure that either the Cordova or PhoneGap CLI is installed globally or locally.');
                    return;
                }
            }
        }
    }

    var plugins = ctx.opts.cordova.plugins;

    if (plugins.indexOf("cordova-plugin-file") == -1) {
        console.log("Adding the cordova-plugin-file@4.3.3... ");
        var output = execSync(cordovaCLI + ' plugin add cordova-plugin-file@4.3.3').toString();
        console.log(output);
        plugins = execSync(cordovaCLI + ' plugin').toString();
    }

    if (plugins.indexOf("cordova-plugin-file-transfer") == -1) {
        console.log("Adding the cordova-plugin-file-transfer@1.6.3... ");
        var output = execSync(cordovaCLI + ' plugin add cordova-plugin-file-transfer@1.6.3').toString();
        console.log(output);
        plugins = execSync(cordovaCLI + ' plugin').toString();
    }

    if (plugins.indexOf("cordova-plugin-zip") == -1) {
        console.log("Adding the cordova-plugin-zip@3.1.0... ");
        var output = execSync(cordovaCLI + ' plugin add cordova-plugin-zip@3.1.0').toString();
        console.log(output);
    }
};

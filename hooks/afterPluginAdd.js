module.exports = function (ctx) {
    var execSync = require('child_process').execSync;
    var fs = require('fs');
    const xmlConfigPath = "./config.xml";

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

    if (!isPluginInListOrInXmlConfig("cordova-plugin-file", plugins)) {
        console.log("Adding the cordova-plugin-file@4.3.3... ");
        var output = execSync(cordovaCLI + ' plugin add cordova-plugin-file@4.3.3').toString();
        console.log(output);
        plugins = execSync(cordovaCLI + ' plugin').toString();
    }

    if (!isPluginInListOrInXmlConfig("cordova-plugin-file-transfer", plugins)) {
        console.log("Adding the cordova-plugin-file-transfer@1.6.3... ");
        var output = execSync(cordovaCLI + ' plugin add cordova-plugin-file-transfer@1.6.3').toString();
        console.log(output);
        plugins = execSync(cordovaCLI + ' plugin').toString();
    }

    if (!isPluginInListOrInXmlConfig("cordova-plugin-zip", plugins)) {
        console.log("Adding the cordova-plugin-zip@3.1.0... ");
        var output = execSync(cordovaCLI + ' plugin add cordova-plugin-zip@3.1.0').toString();
        console.log(output);
    }

    function isPluginInXmlConfig(pluginName) {
        try {
            var xmlConfigFile = fs.readFileSync(xmlConfigPath);
        } catch (e) {
            console.error(e);
            return false;
        }
        return xmlConfigFile.indexOf(`<plugin name="${pluginName}"`) != -1;
    }

    function isPluginInPluginsList(pluginName, pluginsList) {
        return pluginsList.indexOf(pluginName) != -1;
    }

    function isPluginInListOrInXmlConfig(pluginName, pluginsList) {
        return isPluginInPluginsList(pluginName, pluginsList) || isPluginInXmlConfig(pluginName);
    }
};

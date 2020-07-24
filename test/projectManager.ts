/// <reference path="../typings/codePush.d.ts" />
/// <reference types="q" />
/// <reference types="node" />
/// <reference path="../typings/replace.d.ts" />
/// <reference types="mkdirp" />

"use strict";
import tu = require("./testUtil");

import child_process = require("child_process");
import replace = require("replace");
import path = require("path");
import Q = require("q");
import fs = require("fs");
import mkdirp = require("mkdirp");

import platform = require("./platform");

var del = require("del");
var archiver = require("archiver");
var testUtil = tu.TestUtil;

/**
 * In charge of Cordova project related operations.
 */
export class ProjectManager {
    public static ANDROID_KEY_PLACEHOLDER: string = "CODE_PUSH_ANDROID_DEPLOYMENT_KEY";
    public static IOS_KEY_PLACEHOLDER: string = "CODE_PUSH_IOS_DEPLOYMENT_KEY";
    public static SERVER_URL_PLACEHOLDER: string = "CODE_PUSH_SERVER_URL";
    public static INDEX_JS_PLACEHOLDER: string = "CODE_PUSH_INDEX_JS_PATH";
    public static CODE_PUSH_APP_VERSION_PLACEHOLDER: string = "CODE_PUSH_APP_VERSION";
    public static CODE_PUSH_APP_ID_PLACEHOLDER: string = "CODE_PUSH_TEST_APPLICATION_ID";
    public static PLUGIN_VERSION_PLACEHOLDER: string = "CODE_PUSH_PLUGIN_VERSION";

    public static DEFAULT_APP_VERSION: string = "Store version";

    /**
	 * Creates a new cordova test application at the specified path, and configures it
	 * with the given server URL, android and ios deployment keys.
	 */
    public static setupProject(projectDirectory: string,
        templatePath: string,
        appName: string,
        appNamespace: string,
        version: string = ProjectManager.DEFAULT_APP_VERSION): Q.Promise<string> {
        if (fs.existsSync(projectDirectory)) {
            del.sync([projectDirectory], { force: true });
        }
        mkdirp.sync(projectDirectory);

        const indexHtml = "www/index.html";
        const destinationIndexPath = path.join(projectDirectory, indexHtml);
        const packageFile = path.join(templatePath, "package.json");
        const destinationPackageFile = path.join(projectDirectory, "package.json");

        return ProjectManager.execChildProcess("cordova create " + projectDirectory + " " + appNamespace + " " + appName + " --template " + templatePath)
            .then<string>(testUtil.copyFile.bind(undefined, packageFile, destinationPackageFile, true))
            .then<string>(ProjectManager.replaceString.bind(undefined, destinationIndexPath, ProjectManager.CODE_PUSH_APP_VERSION_PLACEHOLDER, version));
    }

    /**
     * Sets up the scenario for a test in an already existing Cordova project.
     */
    public static setupScenario(projectDirectory: string, appId: string, templatePath: string, jsPath: string, targetPlatform: platform.IPlatform, build: boolean = true, version: string = ProjectManager.DEFAULT_APP_VERSION): Q.Promise<string> {
        const indexHtml = "www/index.html";
        const templateIndexPath = path.join(templatePath, indexHtml);
        const destinationIndexPath = path.join(projectDirectory, indexHtml);

        const scenarioJs = "www/" + jsPath;
        const templateScenarioJsPath = path.join(templatePath, scenarioJs);
        const destinationScenarioJsPath = path.join(projectDirectory, scenarioJs);

        const configXml = "config.xml";
        const templateConfigXmlPath = path.join(templatePath, configXml);
        const destinationConfigXmlPath = path.join(projectDirectory, configXml);

        const packageFile = eval("(" + fs.readFileSync("./package.json", "utf8") + ")");
        const pluginVersion = packageFile.version;
        const AndroidManifest = path.join(projectDirectory, "platforms", "android", "app", "src", "main", "AndroidManifest.xml");


        console.log("Setting up scenario " + jsPath + " in " + projectDirectory);

        // copy index html file and replace
        return ProjectManager.copyFile(templateIndexPath, destinationIndexPath, true)
            .then<void>(ProjectManager.replaceString.bind(undefined, destinationIndexPath, ProjectManager.SERVER_URL_PLACEHOLDER, targetPlatform.getServerUrl()))
            .then<void>(ProjectManager.replaceString.bind(undefined, destinationIndexPath, ProjectManager.INDEX_JS_PLACEHOLDER, jsPath))
            .then<void>(ProjectManager.replaceString.bind(undefined, destinationIndexPath, ProjectManager.CODE_PUSH_APP_VERSION_PLACEHOLDER, version))
            // copy scenario js file and replace
            .then<void>(() => {
                return ProjectManager.copyFile(templateScenarioJsPath, destinationScenarioJsPath, true);
            })
            .then<void>(ProjectManager.replaceString.bind(undefined, destinationScenarioJsPath, ProjectManager.SERVER_URL_PLACEHOLDER, targetPlatform.getServerUrl()))
            // copy config xml file and replace
            .then<void>(() => {
                return ProjectManager.copyFile(templateConfigXmlPath, destinationConfigXmlPath, true);
            })
            .then<string>(ProjectManager.replaceString.bind(undefined, destinationConfigXmlPath, ProjectManager.ANDROID_KEY_PLACEHOLDER, platform.Android.getInstance().getDefaultDeploymentKey()))
            .then<string>(ProjectManager.replaceString.bind(undefined, destinationConfigXmlPath, ProjectManager.IOS_KEY_PLACEHOLDER, platform.IOS.getInstance().getDefaultDeploymentKey()))
            .then<string>(ProjectManager.replaceString.bind(undefined, destinationConfigXmlPath, ProjectManager.SERVER_URL_PLACEHOLDER, targetPlatform.getServerUrl()))
            .then<string>(ProjectManager.replaceString.bind(undefined, destinationConfigXmlPath, ProjectManager.PLUGIN_VERSION_PLACEHOLDER, pluginVersion))
            .then<void>(() => { 
                if (targetPlatform.getCordovaName() === "android") {
                return ProjectManager.replaceString(AndroidManifest, "<application android:hardwareAccelerated=\"true\" android:icon=\"@mipmap/ic_launcher\" android:label=\"@string/app_name\" android:supportsRtl=\"true\">", "<application android:hardwareAccelerated=\"true\" android:icon=\"@mipmap/ic_launcher\" android:label=\"@string/app_name\" android:usesCleartextTraffic=\"true\" android:supportsRtl=\"true\">");
                }
            })
            .then<string>(() => {
                return build ? ProjectManager.buildPlatform(projectDirectory, targetPlatform) : ProjectManager.preparePlatform(projectDirectory, targetPlatform);
            });
    }

    /**
     * Creates a CodePush update package zip for a Cordova project.
     */
    public static createUpdateArchive(projectDirectory: string, targetPlatform: platform.IPlatform, isDiff?: boolean): Q.Promise<string> {
        var deferred = Q.defer<string>();
        var archive = archiver.create("zip", {});
        var archivePath = path.join(projectDirectory, "update.zip");

        console.log("Creating an update archive at: " + archivePath);

        if (fs.existsSync(archivePath)) {
            fs.unlinkSync(archivePath);
        }
        var writeStream = fs.createWriteStream(archivePath);
        var targetFolder = targetPlatform.getPlatformWwwPath(projectDirectory);

        writeStream.on("close", function () {
            deferred.resolve(archivePath);
        });

        archive.on("error", function (e: Error) {
            deferred.reject(e);
        });

        if (isDiff) {
            archive.append(`{"deletedFiles":[]}`, { name: "www/hotcodepush.json" });
        }

        archive.directory(targetFolder, "www");
        archive.pipe(writeStream);
        archive.finalize();

        return deferred.promise;
    }

    /**
     * Adds a plugin to a Cordova project.
     */
    public static addPlugin(projectFolder: string, plugin: string): Q.Promise<string> {
        console.log("Adding plugin " + plugin + " to " + projectFolder);
        return ProjectManager.execChildProcess("cordova plugin add " + plugin, { cwd: projectFolder });
    }

    /**
     * Removes a plugin from a Cordova project.
     */
    public static removePlugin(projectFolder: string, plugin: string): Q.Promise<string> {
        console.log("Removing plugin " + plugin + " from " + projectFolder);
        return ProjectManager.execChildProcess("cordova plugin remove " + plugin, { cwd: projectFolder });
    }

    /**
     * Builds a specific platform of a Cordova project. 
     */
    public static buildPlatform(projectFolder: string, targetPlatform: platform.IPlatform): Q.Promise<string> {
        console.log("Building " + targetPlatform.getCordovaName() + " project in " + projectFolder);
        // don't log the iOS build output because it is too verbose and overflows the buffer
        return ProjectManager.execChildProcess("cordova build " + targetPlatform.getCordovaName(), { cwd: projectFolder }, false);
    }

    /**
     * Prepares a specific platform of a Cordova project. 
     */
    public static preparePlatform(projectFolder: string, targetPlatform: platform.IPlatform): Q.Promise<string> {
        console.log("Preparing " + targetPlatform.getCordovaName() + " project in " + projectFolder);
        return ProjectManager.execChildProcess("cordova prepare " + targetPlatform.getCordovaName(), { cwd: projectFolder });
    }

    /**
     * Launch the test app on the given target / platform.
     */
    public static launchApplication(appNamespace: string, targetPlatform: platform.IPlatform): Q.Promise<string> {
        console.log("Launching " + appNamespace + " on " + targetPlatform.getCordovaName());
        return targetPlatform.getEmulatorManager().launchInstalledApplication(appNamespace);
    }

    /**
     * Kill the test app on the given target / platform.
     */
    public static endRunningApplication(appNamespace: string, targetPlatform: platform.IPlatform): Q.Promise<string> {
        console.log("Ending " + appNamespace + " on " + targetPlatform.getCordovaName());
        return targetPlatform.getEmulatorManager().endRunningApplication(appNamespace);
    }

    /**
     * Prepares the emulator for a test.
     */
    public static prepareEmulatorForTest(appNamespace: string, targetPlatform: platform.IPlatform): Q.Promise<string> {
        console.log("Preparing " + targetPlatform.getCordovaName() + " emulator for " + appNamespace + " tests");
        return targetPlatform.getEmulatorManager().prepareEmulatorForTest(appNamespace);
    }

    /**
     * Uninstalls the app from the emulator.
     */
    public static uninstallApplication(appNamespace: string, targetPlatform: platform.IPlatform): Q.Promise<string> {
        console.log("Uninstalling " + appNamespace + " on " + targetPlatform.getCordovaName());
        return targetPlatform.getEmulatorManager().uninstallApplication(appNamespace);
    }

    /**
     * Runs the test app on the given target / platform.
     */
    public static runPlatform(projectFolder: string, targetPlatform: platform.IPlatform, skipBuild: boolean = true, target?: string): Q.Promise<string> {
        console.log("Running project in " + projectFolder + " on " + targetPlatform.getCordovaName());
        var runTarget = target ? " --target " + target : "";
        var nobuild = skipBuild ? " --nobuild" : "";
        return ProjectManager.execChildProcess("cordova run " + targetPlatform.getCordovaName() + runTarget + nobuild, { cwd: projectFolder });
    }

    /**
     * Adds a platform to a Cordova project. 
     */
    public static addPlatform(projectFolder: string, targetPlatform: platform.IPlatform, version?: string): Q.Promise<string> {
        console.log("Adding " + targetPlatform.getCordovaName() + " to project in " + projectFolder);
        return ProjectManager.execChildProcess("cordova platform add " + targetPlatform.getCordovaName() + (version ? "@" + version : ""), { cwd: projectFolder });
    }

    /**
	 * Replaces a regex in a file with a given string.
	 */
    public static replaceString(filePath: string, regex: string, replacement: string): void {
        console.log("replacing \"" + regex + "\" with \"" + replacement + "\" in " + filePath);
        replace({ regex: regex, replacement: replacement, recursive: false, silent: true, paths: [filePath] });
    }

    /**
     * Stops and restarts an application specified by its namespace identifier.
     */
    public static restartApplication(appNamespace: string, targetPlatform: platform.IPlatform): Q.Promise<string> {
        console.log("Restarting " + appNamespace + " on " + targetPlatform.getCordovaName());
        return targetPlatform.getEmulatorManager().restartApplication(appNamespace);
    }

    /**
     * Navigates away from the application and then navigates back to it.
     */
    public static resumeApplication(appNamespace: string, targetPlatform: platform.IPlatform, delayBeforeResumingMs: number = 1000): Q.Promise<string> {
        console.log("Resuming " + appNamespace + " on " + targetPlatform.getCordovaName());
        return targetPlatform.getEmulatorManager().resumeApplication(appNamespace, delayBeforeResumingMs);
    }

    /**
     * Executes a child process and logs its output to the console and returns its output in the promise as a string
     */
    public static execChildProcess(command: string, options?: child_process.ExecOptions, logOutput: boolean = true): Q.Promise<string> {
        var deferred = Q.defer<string>();

        options = options || {};
        options.maxBuffer = 1024 * 1024;
        // abort processes that run longer than five minutes
        options.timeout = 5 * 60 * 1000;

        console.log("Running command: " + command);
        child_process.exec(command, options, (error: Error, stdout: Buffer, stderr: Buffer) => {

            if (logOutput) stdout && console.log(stdout);
            stderr && console.error(stderr);

            if (error) {
                console.error(error);
                deferred.reject(error);
            } else {
                deferred.resolve(stdout.toString());
            }
        });

        return deferred.promise;
    }

    /**
     * Copies a file from a given location to another.
     */
    private static copyFile(source: string, destination: string, overwrite: boolean): Q.Promise<void> {
        var deferred = Q.defer<void>();

        try {
            var errorHandler = (error: any) => {
                deferred.reject(error);
            };

            if (overwrite && fs.existsSync(destination)) {
                fs.unlinkSync(destination);
            }

            var readStream: fs.ReadStream = fs.createReadStream(source);
            readStream.on("error", errorHandler);

            var writeStream: fs.WriteStream = fs.createWriteStream(destination);
            writeStream.on("error", errorHandler);
            writeStream.on("close", deferred.resolve.bind(undefined, undefined));
            readStream.pipe(writeStream);
        } catch (e) {
            deferred.reject(e);
        }

        return deferred.promise;
    }
}
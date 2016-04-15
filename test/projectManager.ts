/// <reference path="../typings/codePush.d.ts" />
/// <reference path="../typings/q.d.ts" />
/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/replace.d.ts" />
/// <reference path="../typings/mkdirp.d.ts" />

"use strict";

import child_process = require("child_process");
import replace = require("replace");
import path = require("path");
import Q = require("q");
import fs = require("fs");
import mkdirp = require("mkdirp");

import platform = require("./platform");
import tu = require("./testUtil");

var del = require("del");
var archiver = require("archiver");

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

    public static DEFAULT_APP_VERSION: string = "Store version";

	/**
	 * Creates a new cordova test application at the specified path, and configures it
	 * with the given server URL, android and ios deployment keys.
	 */
    public static setupTemplate(projectDirectory: string,
        templatePath: string,
        serverURL: string,
        androidKey: string,
        iosKey: string,
        appName: string,
        appNamespace: string,
        version: string = ProjectManager.DEFAULT_APP_VERSION): Q.Promise<string> {
        var configXmlPath = path.join(projectDirectory, "config.xml");
        var indexHtmlPath = path.join(projectDirectory, "www/index.html");
        var setupScenario = "js/scenarioSetup.js";
        var setupScenarioPath = path.join(projectDirectory, "www/", setupScenario);

        if (fs.existsSync(projectDirectory)) {
            del.sync([projectDirectory], { force: true });
        }
        mkdirp.sync(projectDirectory);

        return ProjectManager.execAndLogChildProcess("cordova create " + projectDirectory + " " + appNamespace + " " + appName + " --copy-from " + templatePath)
            // copy the correct values into the config.xml file
            .then<string>(ProjectManager.replaceString.bind(undefined, configXmlPath, ProjectManager.ANDROID_KEY_PLACEHOLDER, androidKey))
            .then<string>(ProjectManager.replaceString.bind(undefined, configXmlPath, ProjectManager.IOS_KEY_PLACEHOLDER, iosKey))
            .then<string>(ProjectManager.replaceString.bind(undefined, configXmlPath, ProjectManager.SERVER_URL_PLACEHOLDER, serverURL))
            // copy the correct values into the index.html file
            .then<string>(ProjectManager.replaceString.bind(undefined, indexHtmlPath, ProjectManager.SERVER_URL_PLACEHOLDER, serverURL))
            .then<string>(ProjectManager.replaceString.bind(undefined, indexHtmlPath, ProjectManager.CODE_PUSH_APP_VERSION_PLACEHOLDER, version))
            .then<string>(ProjectManager.replaceString.bind(undefined, indexHtmlPath, ProjectManager.SERVER_URL_PLACEHOLDER, serverURL))
            .then<string>(ProjectManager.replaceString.bind(undefined, indexHtmlPath, ProjectManager.CODE_PUSH_APP_VERSION_PLACEHOLDER, version))
            // use the setup scenario
            .then<string>(ProjectManager.replaceString.bind(undefined, setupScenarioPath, ProjectManager.SERVER_URL_PLACEHOLDER, serverURL))
            .then<string>(ProjectManager.replaceString.bind(undefined, indexHtmlPath, ProjectManager.SERVER_URL_PLACEHOLDER, serverURL))
            .then<string>(ProjectManager.replaceString.bind(undefined, indexHtmlPath, ProjectManager.INDEX_JS_PLACEHOLDER, setupScenario))
            .then<string>(ProjectManager.replaceString.bind(undefined, indexHtmlPath, ProjectManager.CODE_PUSH_APP_VERSION_PLACEHOLDER, version));
    }
    
    /**
     * Sets up the scenario for a test in an already existing Cordova project.
     */
    public static setupScenario(projectDirectory: string, templatePath: string, jsPath: string, serverURL: string, build: boolean = true, version: string = ProjectManager.DEFAULT_APP_VERSION): Q.Promise<string> {
        var indexHtml = "www/index.html";
        var templateIndexPath = path.join(templatePath, indexHtml);
        var destinationIndexPath = path.join(projectDirectory, indexHtml);
        
        var scenarioJs = "www/" + jsPath;
        var templateScenarioJsPath = path.join(templatePath, scenarioJs);
        var destinationScenarioJsPath = path.join(projectDirectory, scenarioJs);

        return ProjectManager.copyFile(templateIndexPath, destinationIndexPath, true)
            .then<void>(ProjectManager.replaceString.bind(undefined, destinationIndexPath, ProjectManager.SERVER_URL_PLACEHOLDER, serverURL))
            .then<void>(ProjectManager.replaceString.bind(undefined, destinationIndexPath, ProjectManager.INDEX_JS_PLACEHOLDER, jsPath))
            .then<void>(ProjectManager.replaceString.bind(undefined, destinationIndexPath, ProjectManager.CODE_PUSH_APP_VERSION_PLACEHOLDER, version))
            .then<void>(() => {
                return ProjectManager.copyFile(templateScenarioJsPath, destinationScenarioJsPath, true);
            })
            .then<void>(ProjectManager.replaceString.bind(undefined, destinationScenarioJsPath, ProjectManager.SERVER_URL_PLACEHOLDER, serverURL))
            .then<string>(() => {
                return build ? ProjectManager.buildPlatform(projectDirectory) : ProjectManager.preparePlatform(projectDirectory);
            });
    }

    /**
     * Creates a CodePush update package zip for a Cordova project.
     */
    public static createUpdateArchive(projectDirectory: string, isDiff?: boolean): Q.Promise<string> {
        var targetPlatform = platform.PlatformResolver.resolvePlatform(tu.TestUtil.readTargetPlatform());
        
        var deferred = Q.defer<string>();
        var archive = archiver.create("zip", {});
        var archivePath = path.join(projectDirectory, "update.zip");
        console.log("Creating a project update archive at: " + archivePath);

        if (fs.existsSync(archivePath)) {
            fs.unlinkSync(archivePath);
        }
        var writeStream = fs.createWriteStream(archivePath);
        var targetFolder = targetPlatform.getPlatformWwwPath(projectDirectory);

        writeStream.on("close", function() {
            deferred.resolve(archivePath);
        });

        archive.on("error", function(e: Error) {
            deferred.reject(e);
        });

        if (isDiff) {
            archive.append(`{"deletedFiles":[]}`, { name: "hotcodepush.json" });
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
        return ProjectManager.execAndLogChildProcess("cordova plugin add " + plugin, { cwd: projectFolder });
    }    

    /**
     * Builds a specific platform of a Cordova project. 
     */
    public static buildPlatform(projectFolder: string): Q.Promise<string> {
        var targetPlatform = platform.PlatformResolver.resolvePlatform(tu.TestUtil.readTargetPlatform());
        
        // don't print output here because the iOS build process outputs so much nonsense that it buffer overflows and exits the entire test process
        return ProjectManager.execAndLogChildProcess("cordova build " + targetPlatform.getCordovaName(), { cwd: projectFolder }, false);
    }
    
    /**
     * Prepares a specific platform of a Cordova project. 
     */
    public static preparePlatform(projectFolder: string): Q.Promise<string> {
        var targetPlatform = platform.PlatformResolver.resolvePlatform(tu.TestUtil.readTargetPlatform());
        
        return ProjectManager.execAndLogChildProcess("cordova prepare " + targetPlatform.getCordovaName(), { cwd: projectFolder });
    }

    /**
     * Launch the test app on the given target / platform.
     */
    public static launchApplication(namespace: string): Q.Promise<string> {
        var targetPlatform = platform.PlatformResolver.resolvePlatform(tu.TestUtil.readTargetPlatform());
        
        var emulatorManager = targetPlatform.getEmulatorManager();
        if (emulatorManager) {
            return emulatorManager.launchInstalledApplication(namespace);
        } else {
            console.log("No emulator manager found!");
            return null;
        }
    }

    /**
     * Kill the test app on the given target / platform.
     */
    public static endRunningApplication(namespace: string): Q.Promise<string> {
        var targetPlatform = platform.PlatformResolver.resolvePlatform(tu.TestUtil.readTargetPlatform());
        
        var emulatorManager = targetPlatform.getEmulatorManager();
        if (emulatorManager) {
            return emulatorManager.endRunningApplication(namespace);
        } else {
            console.log("No emulator manager found!");
            return null;
        }
    }

    /**
     * Prepares the emulator for a test.
     */
    public static prepareEmulatorForTest(namespace: string): Q.Promise<string> {
        var targetPlatform = platform.PlatformResolver.resolvePlatform(tu.TestUtil.readTargetPlatform());
        
        var emulatorManager = targetPlatform.getEmulatorManager();
        if (emulatorManager) {
            return emulatorManager.prepareEmulatorForTest(namespace);
        } else {
            console.log("No emulator manager found!");
            return null;
        }
    }

    /**
     * Runs the test app on the given target / platform.
     */
    public static runPlatform(projectFolder: string, skipBuild: boolean = true, target?: string): Q.Promise<string> {
        var targetPlatform = platform.PlatformResolver.resolvePlatform(tu.TestUtil.readTargetPlatform());
        var runTarget = " --target " + target ? target : tu.TestUtil.readTargetEmulator();
        var nobuild = skipBuild ? " --nobuild" : "";
        return ProjectManager.execAndLogChildProcess("cordova run " + targetPlatform.getCordovaName() + runTarget + nobuild, { cwd: projectFolder });
    }

    /**
     * Adds a platform to a Cordova project. 
     */
    public static addPlatform(projectFolder: string, version?: string): Q.Promise<string> {
        var targetPlatform = platform.PlatformResolver.resolvePlatform(tu.TestUtil.readTargetPlatform());
        return ProjectManager.execAndLogChildProcess("cordova platform add " + targetPlatform.getCordovaName() + (version ? "@" + version : ""), { cwd: projectFolder });
    }

	/**
	 * Replaces a regex in a file with a given string.
	 */
    public static replaceString(filePath: string, regex: string, replacement: string): void {
        replace({ regex: regex, replacement: replacement, recursive: false, silent: false, paths: [filePath] });
    }

    /**
     * Stops and restarts an application specified by its namespace identifier.
     */
    public static restartApplication(namespace: string): Q.Promise<string> {
        var targetPlatform = platform.PlatformResolver.resolvePlatform(tu.TestUtil.readTargetPlatform());
        var emulatorManager = targetPlatform.getEmulatorManager();
        if (emulatorManager) {
            return emulatorManager.restartApplication(namespace);
        } else {
            console.log("No emulator manager found!");
            return null;
        }
    }
    
    /**
     * Navigates away from the application and then navigates back to it.
     */
    public static resumeApplication(namespace: string, delayBeforeResumingMs: number = 1000): Q.Promise<string> {
        var targetPlatform = platform.PlatformResolver.resolvePlatform(tu.TestUtil.readTargetPlatform());
        var emulatorManager = targetPlatform.getEmulatorManager();
        if (emulatorManager) {
            return emulatorManager.resumeApplication(namespace, delayBeforeResumingMs);
        } else {
            console.log("No emulator manager found!");
            return null;
        }
    }

    /**
     * Executes a child process and logs its output to the console and returns its output in the promise as a string
     */
    public static execAndLogChildProcess(command: string, options?: child_process.IExecOptions, output: boolean = true): Q.Promise<string> {
        var deferred = Q.defer<string>();

        options = options || {};
        options.maxBuffer = 1024 * 500;

        console.log("Running command: " + command);
        child_process.exec(command, options, (error: Error, stdout: Buffer, stderr: Buffer) => {

            if (output) stdout && console.log(stdout);
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
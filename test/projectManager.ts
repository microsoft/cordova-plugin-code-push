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

var del = require("del");
var archiver = require("archiver");

/**
 * In charge of Cordova project related operations.
 */
export class ProjectManager {
    public static ANDROID_KEY_PLACEHOLDER: string = "CODE_PUSH_ANDROID_DEPOYMENT_KEY";
    public static IOS_KEY_PLACEHOLDER: string = "CODE_PUSH_IOS_DEPLOYMENT_KEY";
    public static SERVER_URL_PLACEHOLDER: string = "CODE_PUSH_SERVER_URL";
    public static INDEX_JS_PLACEHOLDER: string = "CODE_PUSH_INDEX_JS_PATH";
    public static CODE_PUSH_APP_VERSION_PLACEHOLDER: string = "CODE_PUSH_APP_VERSION";

    public static DEFAULT_APP_VERSION: string = "Store version";

	/**
	 * Creates a new cordova test application at the specified path, and configures it
	 * with the given server URL, android and ios deployment keys.
	 */
    public static setupTemplate(destinationPath: string,
        templatePath: string,
        serverURL: string,
        androidKey: string,
        iosKey: string,
        appName: string,
        appNamespace: string,
        jsPath: string,
        appVersion: string = ProjectManager.DEFAULT_APP_VERSION): Q.Promise<void> {
        var configXmlPath = path.join(destinationPath, "config.xml");
        var indexHtmlPath = path.join(destinationPath, "www/index.html");
        var indexJsPath = path.join(destinationPath, "www/" + jsPath);

        if (fs.existsSync(destinationPath)) {
            del.sync([destinationPath], { force: true });
        }
        mkdirp.sync(destinationPath);

        return ProjectManager.execAndLogChildProcess("cordova create " + destinationPath + " " + appNamespace + " " + appName + " --copy-from " + templatePath)
            .then<void>(ProjectManager.replaceString.bind(undefined, configXmlPath, ProjectManager.ANDROID_KEY_PLACEHOLDER, androidKey))
            .then<void>(ProjectManager.replaceString.bind(undefined, configXmlPath, ProjectManager.IOS_KEY_PLACEHOLDER, iosKey))
            .then<void>(ProjectManager.replaceString.bind(undefined, configXmlPath, ProjectManager.SERVER_URL_PLACEHOLDER, serverURL))
            .then<void>(ProjectManager.replaceString.bind(undefined, indexHtmlPath, ProjectManager.SERVER_URL_PLACEHOLDER, serverURL))
            .then<void>(ProjectManager.replaceString.bind(undefined, indexHtmlPath, ProjectManager.INDEX_JS_PLACEHOLDER, jsPath))
            .then<void>(ProjectManager.replaceString.bind(undefined, indexHtmlPath, ProjectManager.CODE_PUSH_APP_VERSION_PLACEHOLDER, appVersion))
            .then<void>(ProjectManager.replaceString.bind(undefined, indexJsPath, ProjectManager.SERVER_URL_PLACEHOLDER, serverURL));
    }
    
    /**
     * Updates an already existing Cordova project.
     */
    public static updateProject(destinationPath: string, templatePath: string, version: string, platform: string, jsPath: string, serverURL: string): Q.Promise<void> {
        var templateIndexPath = path.join(templatePath, "www/index.html");
        var destination = path.join(destinationPath, "www/index.html");

        return ProjectManager.copyFile(templateIndexPath, destinationPath, true)
            .then<void>(ProjectManager.replaceString.bind(undefined, destination, ProjectManager.SERVER_URL_PLACEHOLDER, serverURL))
            .then<void>(ProjectManager.replaceString.bind(undefined, destination, ProjectManager.INDEX_JS_PLACEHOLDER, jsPath))
            .then<void>(ProjectManager.replaceString.bind(undefined, destination, ProjectManager.CODE_PUSH_APP_VERSION_PLACEHOLDER, version));
    }

    /**
     * Creates a CodePush update package zip for a Cordova project.
     */
    public static createUpdateArchive(projectLocation: string, targetPlatform: platform.IPlatform): Q.Promise<string> {
        var deferred = Q.defer<string>();
        var archive = archiver.create("zip", {});
        var archivePath = path.join(projectLocation, "update.zip");
        console.log("Creating a project update archive at: " + archivePath);

        if (fs.existsSync(archivePath)) {
            fs.unlinkSync(archivePath);
        }
        var writeStream = fs.createWriteStream(archivePath);
        var targetFolder = targetPlatform.getPlatformWwwPath(projectLocation);

        writeStream.on("close", function() {
            deferred.resolve(archivePath);
        });

        archive.on("error", function(e: Error) {
            deferred.reject(e);
        });

        archive.directory(targetFolder, "www");
        archive.pipe(writeStream);
        archive.finalize();

        return deferred.promise;
    }

    /**
     * Adds a plugin to a Cordova project.
     */
    public static addPlugin(projectFolder: string, plugin: string): Q.Promise<void> {
        return ProjectManager.execAndLogChildProcess("cordova plugin add " + plugin, { cwd: projectFolder });
    }    

    /**
     * Builds a specific platform of a Cordova project. 
     */
    public static buildPlatform(projectFolder: string, targetPlatform: platform.IPlatform): Q.Promise<void> {
        return ProjectManager.execAndLogChildProcess("cordova build " + targetPlatform.getCordovaName(), { cwd: projectFolder });
    }

    /**
     * Runs a project to a given target / platform.
     */
    public static runPlatform(projectFolder: string, targetPlatform: platform.IPlatform, skipBuild: boolean = false, target?: string): Q.Promise<void> {
        var runTarget = target ? " --target " + target : "";
        var nobuild = skipBuild ? " --nobuild" : "";
        return ProjectManager.execAndLogChildProcess("cordova run " + targetPlatform.getCordovaName() + runTarget + nobuild, { cwd: projectFolder });
    }

    /**
     * Adds a platform to a Cordova project. 
     */
    public static addPlatform(projectFolder: string, targetPlatform: platform.IPlatform): Q.Promise<void> {
        return ProjectManager.execAndLogChildProcess("cordova platform add " + targetPlatform.getCordovaName(), { cwd: projectFolder });
    }

	/**
	 * Replaces a regex in a file with a given string.
	 */
    public static replaceString(filePath: string, regex: string, replacement: string): void {
        replace({ regex: regex, replacement: replacement, recursive: false, silent: false, paths: [filePath] });
    }

    /**
     * Executes a child process and logs its output to the console.
     */
    private static execAndLogChildProcess(command: string, options?: child_process.IExecOptions): Q.Promise<void> {
        var deferred = Q.defer<void>();
        
        options = options || {};
        options.maxBuffer = 1024 * 500;
           
        console.log("Running command: " + command);
        child_process.exec(command, options, (error: Error, stdout: Buffer, stderr: Buffer) => {

            stdout && console.log(stdout);
            stderr && console.error(stderr);

            if (error) {
                console.error(error);
                deferred.reject(error);
            } else {
                deferred.resolve(undefined);
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
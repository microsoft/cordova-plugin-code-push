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

var del = require("del");

/**
 * In charge of Cordova project related operations.
 */
export class ProjectManager {
    public static ANDROID_KEY_PLACEHOLDER: string = "CODE_PUSH_ANDROID_DEPOYMENT_KEY";
    public static IOS_KEY_PLACEHOLDER: string = "CODE_PUSH_IOS_DEPLOYMENT_KEY";
    public static SERVER_URL_PLACEHOLDER: string = "CODE_PUSH_SERVER_URL";
    public static INDEX_JS_PLACEHOLDER: string = "CODE_PUSH_INDEX_JS_PATH";

	/**
	 * Creates a new cordova test application at the specified path, and configures it
	 * with the given server URL, android and ios deployment keys.
	 */
    public static setupTemplate(destinationPath: string, templatePath: string, serverURL: string, androidKey: string, iosKey: string, appName: string, appNamespace: string, jsPath: string): Q.Promise<void> {
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
            .then<void>(ProjectManager.replaceString.bind(undefined, indexJsPath, ProjectManager.SERVER_URL_PLACEHOLDER, serverURL));
    }

    /**
     * Adds a plugin to a Cordova project.
     */
    public static addPlugin(projectFolder: string, plugin: string): Q.Promise<void> {
        return ProjectManager.execAndLogChildProcess("cordova plugin add " + plugin, { cwd: projectFolder });
    }    

    /**
     * Adds a platform to a Cordova project. 
     */
    public static buildPlatform(projectFolder: string, platformName: string): Q.Promise<void> {
        return ProjectManager.execAndLogChildProcess("cordova build " + platformName, { cwd: projectFolder });
    }

    /**
     * Runs a project to a given target / platform.
     */
    public static runPlatform(projectFolder: string, platformName: string, skipBuild: boolean = false, target?: string): Q.Promise<void> {
        var runTarget = target ? " --target " + target : "";
        var nobuild = skipBuild ? " --nobuild" : "";
        return ProjectManager.execAndLogChildProcess("cordova run " + platformName + runTarget + nobuild, { cwd: projectFolder });
    }

    /**
     * Adds a platform to a Cordova project. 
     */
    public static addPlatform(projectFolder: string, platformName: string): Q.Promise<void> {
        return ProjectManager.execAndLogChildProcess("cordova platform add " + platformName, { cwd: projectFolder });
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
}
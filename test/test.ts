/// <reference path="../typings/assert.d.ts" />
/// <reference path="../typings/codePush.d.ts" />
/// <reference path="../typings/code-push-plugin-testing-framework.d.ts" />
/// <reference path="../typings/mocha.d.ts" />
/// <reference path="../typings/mkdirp.d.ts" />
/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/q.d.ts" />

"use strict";

import assert = require("assert");
import fs = require("fs");
import mkdirp = require("mkdirp");
import path = require("path");

import { Platform, PluginTestingFramework, ProjectManager, ServerUtil, TestUtil } from "code-push-plugin-testing-framework";

import Q = require("q");

var del = require("del");

//////////////////////////////////////////////////////////////////////////////////////////
// Create the platforms to run the tests on.

interface CordovaPlatform {
    /**
     * Returns the name of the platform used in Cordova CLI methods.
     */
    getCordovaName(): string;
    
    /**
     * Called when the platform is prepared.
     */
    onPreparePlatform(projectManager: CordovaProjectManager, projectDirectory: string): Q.Promise<string>;
    
    /**
     * Called when the platform is cleaned up.
     */
    onCleanupPlatform(projectManager: CordovaProjectManager, projectDirectory: string): Q.Promise<string>;
    
    /**
     * Returns the path to this platform's www folder
     */
    getPlatformWwwPath(projectDirectory: string): string;
}

/**
 * Platform used for running tests on Android
 */
class CordovaAndroid extends Platform.Android implements CordovaPlatform {
    constructor() {
        super(new Platform.AndroidEmulatorManager());
    }
    
    /**
     * Returns the name of the platform used in Cordova CLI methods.
     */
    getCordovaName(): string {
        return "android";
    }
    
    /**
     * Called when the platform is prepared.
     */
    onPreparePlatform(projectManager: CordovaProjectManager, projectDirectory: string): Q.Promise<string> {
        // Noop
        return null;
    }
    
    /**
     * Called when the platform is cleaned up.
     */
    onCleanupPlatform(projectManager: CordovaProjectManager, projectDirectory: string): Q.Promise<string> {
        // Noop
        return null;
    }
    
    /**
     * Returns the path to this platform's www folder
     */
    getPlatformWwwPath(projectDirectory: string): string {
        return path.join(projectDirectory, "platforms/android/assets/www");
    }
}

/**
 * Platform used for running tests on iOS using the UIWebView
 */
class CordovaIOSUI extends Platform.IOS implements CordovaPlatform {
    constructor() {
        super(new Platform.IOSEmulatorManager());
    }

    /**
     * Gets the platform name. (e.g. "android" for the Android platform).
     */
    public getName(): string {
        return "ios (uiwebview)";
    }
    
    /**
     * Returns the name of the platform used in Cordova CLI methods.
     */
    getCordovaName(): string {
        return "ios";
    }
    
    /**
     * Called when the platform is prepared.
     */
    onPreparePlatform(projectManager: CordovaProjectManager, projectDirectory: string): Q.Promise<string> {
        // Noop
        return null;
    }
    
    /**
     * Called when the platform is cleaned up.
     */
    onCleanupPlatform(projectManager: CordovaProjectManager, projectDirectory: string): Q.Promise<string> {
        // Noop
        return null;
    }
    
    /**
     * Returns the path to this platform's www folder
     */
    getPlatformWwwPath(projectDirectory: string): string {
        return path.join(projectDirectory, "platforms/ios/www");
    }
}

/**
 * Platform used for running tests on iOS using the WkWebView
 */
class CordovaIOSWK extends CordovaIOSUI {
    public static WkWebViewEnginePluginName = "cordova-plugin-wkwebview-engine";
    
    constructor() {
        super();
    }

    /**
     * Gets the platform name. (e.g. "android" for the Android platform).
     */
    public getName(): string {
        return "ios (wkwebview)";
    }
    
    /**
     * The command line flag used to determine whether or not this platform should run.
     * Runs when the flag is present, doesn't run otherwise.
     */
    getCommandLineFlagName(): string {
        return "--ios-wk";
    }
    
    /**
     * Called when the platform is prepared.
     */
    onPreparePlatform(projectManager: CordovaProjectManager, projectDirectory: string): Q.Promise<string> {
        return projectManager.addCordovaPlugin(projectDirectory, CordovaIOSWK.WkWebViewEnginePluginName);
    }
    
    /**
     * Called when the platform is cleaned up.
     */
    onCleanupPlatform(projectManager: CordovaProjectManager, projectDirectory: string): Q.Promise<string> {
        return projectManager.removeCordovaPlugin(projectDirectory, CordovaIOSWK.WkWebViewEnginePluginName);
    }
}

var supportedPlatforms: Platform.IPlatform[] = [new CordovaAndroid(), new CordovaIOSUI(), new CordovaIOSWK()];

//////////////////////////////////////////////////////////////////////////////////////////
// Create the ProjectManager to use for the tests.

class CordovaProjectManager extends ProjectManager {
    public static AcquisitionSDKPluginName = "code-push";
    
    /**
     * Returns the name of the plugin being tested, ie Cordova or React-Native
     */
    public getPluginName(): string {
        return "Cordova";
    }

	/**
	 * Creates a new test application at the specified path, and configures it
	 * with the given server URL, android and ios deployment keys.
	 */
    public setupProject(projectDirectory: string, templatePath: string, appName: string, appNamespace: string, version?: string): Q.Promise<string> {
        if (fs.existsSync(projectDirectory)) {
            del.sync([projectDirectory], { force: true });
        }
        mkdirp.sync(projectDirectory);
        
        var indexHtml = "www/index.html";
        var destinationIndexPath = path.join(projectDirectory, indexHtml);

        return TestUtil.getProcessOutput("cordova create " + projectDirectory + " " + appNamespace + " " + appName + " --copy-from " + templatePath)
            .then<string>(TestUtil.replaceString.bind(undefined, destinationIndexPath, TestUtil.CODE_PUSH_APP_VERSION_PLACEHOLDER, version))
            .then<string>(this.addCordovaPlugin.bind(this, projectDirectory, CordovaProjectManager.AcquisitionSDKPluginName))
            .then<string>(this.addCordovaPlugin.bind(this, projectDirectory, PluginTestingFramework.thisPluginPath));
    }
    
    /**
     * Sets up the scenario for a test in an already existing project.
     */
    public setupScenario(projectDirectory: string, appId: string, templatePath: string, jsPath: string, targetPlatform: Platform.IPlatform, version?: string): Q.Promise<string> {
        var indexHtml = "www/index.html";
        var templateIndexPath = path.join(templatePath, indexHtml);
        var destinationIndexPath = path.join(projectDirectory, indexHtml);
        
        var scenarioJs = "www/" + jsPath;
        var templateScenarioJsPath = path.join(templatePath, scenarioJs);
        var destinationScenarioJsPath = path.join(projectDirectory, scenarioJs);
        
        var configXml = "config.xml";
        var templateConfigXmlPath = path.join(templatePath, configXml);
        var destinationConfigXmlPath = path.join(projectDirectory, configXml);
        
        var packageFile = eval("(" + fs.readFileSync("./package.json", "utf8") + ")");
        var pluginVersion = packageFile.version;
        
        console.log("Setting up scenario " + jsPath + " in " + projectDirectory);

        // copy index html file and replace
        return TestUtil.copyFile(templateIndexPath, destinationIndexPath, true)
            .then(TestUtil.replaceString.bind(undefined, destinationIndexPath, TestUtil.SERVER_URL_PLACEHOLDER, targetPlatform.getServerUrl()))
            .then(TestUtil.replaceString.bind(undefined, destinationIndexPath, TestUtil.INDEX_JS_PLACEHOLDER, jsPath))
            .then(TestUtil.replaceString.bind(undefined, destinationIndexPath, TestUtil.CODE_PUSH_APP_VERSION_PLACEHOLDER, version))
            // copy scenario js file and replace
            .then(() => {
                return TestUtil.copyFile(templateScenarioJsPath, destinationScenarioJsPath, true);
            })
            .then(TestUtil.replaceString.bind(undefined, destinationScenarioJsPath, TestUtil.SERVER_URL_PLACEHOLDER, targetPlatform.getServerUrl()))
            // copy config xml file and replace
            .then(() => {
                return TestUtil.copyFile(templateConfigXmlPath, destinationConfigXmlPath, true);
            })
            .then(TestUtil.replaceString.bind(undefined, destinationConfigXmlPath, TestUtil.ANDROID_KEY_PLACEHOLDER, targetPlatform.getDefaultDeploymentKey()))
            .then(TestUtil.replaceString.bind(undefined, destinationConfigXmlPath, TestUtil.IOS_KEY_PLACEHOLDER, targetPlatform.getDefaultDeploymentKey()))
            .then(TestUtil.replaceString.bind(undefined, destinationConfigXmlPath, TestUtil.SERVER_URL_PLACEHOLDER, targetPlatform.getServerUrl()))
            .then(TestUtil.replaceString.bind(undefined, destinationConfigXmlPath, TestUtil.PLUGIN_VERSION_PLACEHOLDER, pluginVersion))
            .then<string>(this.prepareCordovaPlatform.bind(this, projectDirectory, targetPlatform));
    }

    /**
     * Creates a CodePush update package zip for a project.
     */
    public createUpdateArchive(projectDirectory: string, targetPlatform: Platform.IPlatform, isDiff?: boolean): Q.Promise<string> {
        return TestUtil.archiveFolder((<CordovaPlatform><any>targetPlatform).getPlatformWwwPath(projectDirectory), path.join(projectDirectory, "update.zip"), isDiff);
    }
    
    /**
     * Prepares a specific platform for tests.
     */
    public preparePlatform(projectDirectory: string, targetPlatform: Platform.IPlatform): Q.Promise<string> {
        return this.addCordovaPlatform(projectDirectory, targetPlatform)
            .then<string>(() => {
                return (<CordovaPlatform><any>targetPlatform).onPreparePlatform(this, projectDirectory);
            });
    }
    
    /**
     * Cleans up a specific platform after tests.
     */
    public cleanupAfterPlatform(projectDirectory: string, targetPlatform: Platform.IPlatform): Q.Promise<string> {
        return this.removeCordovaPlatform(projectDirectory, targetPlatform)
            .then<string>(() => {
                return (<CordovaPlatform><any>targetPlatform).onCleanupPlatform(this, projectDirectory);
            });
    }

    /**
     * Runs the test app on the given target / platform.
     */
    public runApplication(projectDirectory: string, targetPlatform: Platform.IPlatform): Q.Promise<string> {
        console.log("Running project in " + projectDirectory + " on " + targetPlatform.getName());
        // Don't log the build output because iOS's build output is too verbose and overflows the buffer!
        return TestUtil.getProcessOutput("cordova run " + (<CordovaPlatform><any>targetPlatform).getCordovaName(), { cwd: projectDirectory }, false);
    }

    /**
     * Prepares the Cordova project for the test app on the given target / platform.
     */
    public prepareCordovaPlatform(projectDirectory: string, targetPlatform: Platform.IPlatform): Q.Promise<string> {
        console.log("Preparing project in " + projectDirectory + " for " + targetPlatform.getName());
        return TestUtil.getProcessOutput("cordova prepare " + (<CordovaPlatform><any>targetPlatform).getCordovaName(), { cwd: projectDirectory });
    }

    /**
     * Adds a platform to a Cordova project. 
     */
    public addCordovaPlatform(projectDirectory: string, targetPlatform: Platform.IPlatform, version?: string): Q.Promise<string> {
        console.log("Adding " + targetPlatform.getName() + " to project in " + projectDirectory);
        return TestUtil.getProcessOutput("cordova platform add " + (<CordovaPlatform><any>targetPlatform).getCordovaName() + (version ? "@" + version : ""), { cwd: projectDirectory });
    }

    /**
     * Adds a platform to a Cordova project. 
     */
    public removeCordovaPlatform(projectDirectory: string, targetPlatform: Platform.IPlatform, version?: string): Q.Promise<string> {
        console.log("Removing " + targetPlatform.getName() + " to project in " + projectDirectory);
        return TestUtil.getProcessOutput("cordova platform remove " + (<CordovaPlatform><any>targetPlatform).getCordovaName() + (version ? "@" + version : ""), { cwd: projectDirectory });
    }
    
    /**
     * Adds a plugin to a Cordova project.
     */
    public addCordovaPlugin(projectDirectory: string, plugin: string): Q.Promise<string> {
        console.log("Adding plugin " + plugin + " to " + projectDirectory);
        return TestUtil.getProcessOutput("cordova plugin add " + plugin, { cwd: projectDirectory });
    }  
    
    /**
     * Removes a plugin from a Cordova project.
     */
    public removeCordovaPlugin(projectDirectory: string, plugin: string): Q.Promise<string> {
        console.log("Removing plugin " + plugin + " from " + projectDirectory);
        return TestUtil.getProcessOutput("cordova plugin remove " + plugin, { cwd: projectDirectory });
    }
};

//////////////////////////////////////////////////////////////////////////////////////////
// Create the tests.

// Scenarios used in the tests.
const ScenarioCheckForUpdatePath = "js/scenarioCheckForUpdate.js";
const ScenarioCheckForUpdateCustomKey = "js/scenarioCheckForUpdateCustomKey.js";
const ScenarioDownloadUpdate = "js/scenarioDownloadUpdate.js";
const ScenarioInstall = "js/scenarioInstall.js";
const ScenarioInstallOnResumeWithRevert = "js/scenarioInstallOnResumeWithRevert.js";
const ScenarioInstallOnRestartWithRevert = "js/scenarioInstallOnRestartWithRevert.js";
const ScenarioInstallWithRevert = "js/scenarioInstallWithRevert.js";
const ScenarioSync1x = "js/scenarioSync.js";
const ScenarioSyncResume = "js/scenarioSyncResume.js";
const ScenarioSyncResumeDelay = "js/scenarioSyncResumeDelay.js";
const ScenarioSyncRestartDelay = "js/scenarioSyncResumeDelay.js";
const ScenarioSync2x = "js/scenarioSync2x.js";
const ScenarioRestart = "js/scenarioRestart.js";
const ScenarioSyncMandatoryDefault = "js/scenarioSyncMandatoryDefault.js";
const ScenarioSyncMandatoryResume = "js/scenarioSyncMandatoryResume.js";
const ScenarioSyncMandatoryRestart = "js/scenarioSyncMandatoryRestart.js";

const UpdateDeviceReady = "js/updateDeviceReady.js";
const UpdateNotifyApplicationReady = "js/updateNotifyApplicationReady.js";
const UpdateSync = "js/updateSync.js";
const UpdateSync2x = "js/updateSync2x.js";
const UpdateNotifyApplicationReadyConditional = "js/updateNARConditional.js";

// Describe the tests.
var testBuilderDescribes: PluginTestingFramework.TestBuilderDescribe[] = [
    
    new PluginTestingFramework.TestBuilderDescribe("#window.codePush.checkForUpdate",
    
        [
            new PluginTestingFramework.TestBuilderIt("window.codePush.checkForUpdate.noUpdate",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    var noUpdateResponse = PluginTestingFramework.createDefaultResponse();
                    noUpdateResponse.isAvailable = false;
                    noUpdateResponse.appVersion = "0.0.1";
                    PluginTestingFramework.updateResponse = { updateInfo: noUpdateResponse };

                    PluginTestingFramework.testMessageCallback = (requestBody: any) => {
                        try {
                            assert.equal(ServerUtil.TestMessage.CHECK_UP_TO_DATE, requestBody.message);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    };

                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                },
                false),
            
            new PluginTestingFramework.TestBuilderIt("window.codePush.checkForUpdate.sendsBinaryHash",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    var noUpdateResponse = PluginTestingFramework.createDefaultResponse();
                    noUpdateResponse.isAvailable = false;
                    noUpdateResponse.appVersion = "0.0.1";

                    PluginTestingFramework.updateCheckCallback = (request: any) => {
                        try {
                            assert(request.query.packageHash);
                        } catch (e) {
                            done(e);
                        }
                    };
                    
                    PluginTestingFramework.updateResponse = { updateInfo: noUpdateResponse };

                    PluginTestingFramework.testMessageCallback = (requestBody: any) => {
                        try {
                            assert.equal(ServerUtil.TestMessage.CHECK_UP_TO_DATE, requestBody.message);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    };

                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                }, false),
            
            new PluginTestingFramework.TestBuilderIt("window.codePush.checkForUpdate.noUpdate.updateAppVersion", 
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    var updateAppVersionResponse = PluginTestingFramework.createDefaultResponse();
                    updateAppVersionResponse.updateAppVersion = true;
                    updateAppVersionResponse.appVersion = "2.0.0";

                    PluginTestingFramework.updateResponse = { updateInfo: updateAppVersionResponse };

                    PluginTestingFramework.testMessageCallback = (requestBody: any) => {
                        try {
                            assert.equal(ServerUtil.TestMessage.CHECK_UP_TO_DATE, requestBody.message);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    };

                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                }, false),
            
            new PluginTestingFramework.TestBuilderIt("window.codePush.checkForUpdate.update", 
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    var updateResponse = PluginTestingFramework.createUpdateResponse();
                    PluginTestingFramework.updateResponse = { updateInfo: updateResponse };

                    PluginTestingFramework.testMessageCallback = (requestBody: any) => {
                        try {
                            assert.equal(ServerUtil.TestMessage.CHECK_UPDATE_AVAILABLE, requestBody.message);
                            assert.notEqual(null, requestBody.args[0]);
                            var remotePackage: IRemotePackage = requestBody.args[0];
                            assert.equal(remotePackage.downloadUrl, updateResponse.downloadURL);
                            assert.equal(remotePackage.isMandatory, updateResponse.isMandatory);
                            assert.equal(remotePackage.label, updateResponse.label);
                            assert.equal(remotePackage.packageHash, updateResponse.packageHash);
                            assert.equal(remotePackage.packageSize, updateResponse.packageSize);
                            assert.equal(remotePackage.deploymentKey, targetPlatform.getDefaultDeploymentKey());
                            done();
                        } catch (e) {
                            done(e);
                        }
                    };

                    PluginTestingFramework.updateCheckCallback = (request: any) => {
                        try {
                            assert.notEqual(null, request);
                            assert.equal(request.query.deploymentKey, targetPlatform.getDefaultDeploymentKey());
                        } catch (e) {
                            done(e);
                        }
                    };

                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                }, true),
            
            new PluginTestingFramework.TestBuilderIt("window.codePush.checkForUpdate.error", 
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = "invalid {{ json";

                    PluginTestingFramework.testMessageCallback = (requestBody: any) => {
                        try {
                            assert.equal(ServerUtil.TestMessage.CHECK_ERROR, requestBody.message);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    };

                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                }, false)
        ], ScenarioCheckForUpdatePath),
    
    new PluginTestingFramework.TestBuilderDescribe("#window.codePush.checkForUpdate.customKey",
        
        [new PluginTestingFramework.TestBuilderIt("window.codePush.checkForUpdate.customKey.update",
            (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                var updateResponse = PluginTestingFramework.createUpdateResponse();
                PluginTestingFramework.updateResponse = { updateInfo: updateResponse };

                PluginTestingFramework.updateCheckCallback = (request: any) => {
                    try {
                        assert.notEqual(null, request);
                        assert.equal(request.query.deploymentKey, "CUSTOM-DEPLOYMENT-KEY");
                        done();
                    } catch (e) {
                        done(e);
                    }
                };

                projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
            }, false)],
        ScenarioCheckForUpdateCustomKey),
        
    new PluginTestingFramework.TestBuilderDescribe("#remotePackage.download",
        
        [
            new PluginTestingFramework.TestBuilderIt("remotePackage.download.success",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    /* pass the path to any file for download (here, config.xml) to make sure the download completed callback is invoked */
                    PluginTestingFramework.updatePackagePath = path.join(PluginTestingFramework.templatePath, "config.xml");

                    PluginTestingFramework.testMessageCallback = (requestBody: any) => {
                        try {
                            assert.equal(ServerUtil.TestMessage.DOWNLOAD_SUCCEEDED, requestBody.message);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    };

                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                }, false),
            
            new PluginTestingFramework.TestBuilderIt("remotePackage.download.error",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    /* pass an invalid path */
                    PluginTestingFramework.updatePackagePath = path.join(PluginTestingFramework.templatePath, "invalid_path.zip");

                    PluginTestingFramework.testMessageCallback = (requestBody: any) => {
                        try {
                            assert.equal(ServerUtil.TestMessage.DOWNLOAD_ERROR, requestBody.message);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    };

                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                }, false)
        ], ScenarioDownloadUpdate),
        
    new PluginTestingFramework.TestBuilderDescribe("#localPackage.install",
    
        [
            new PluginTestingFramework.TestBuilderIt("localPackage.install.unzip.error",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    /* pass an invalid zip file, here, config.xml */
                    PluginTestingFramework.updatePackagePath = path.join(PluginTestingFramework.templatePath, "config.xml");

                    PluginTestingFramework.testMessageCallback = (requestBody: any) => {
                        try {
                            assert.equal(ServerUtil.TestMessage.INSTALL_ERROR, requestBody.message);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    };

                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                }, false),
            
            new PluginTestingFramework.TestBuilderIt("localPackage.install.handlesDiff.againstBinary",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    /* create an update */
                    PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateNotifyApplicationReady, "Diff Update 1")
                        .then<void>((updatePath: string) => {
                            PluginTestingFramework.updatePackagePath = updatePath;
                            projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                            return PluginTestingFramework.expectTestMessages([
                                ServerUtil.TestMessage.UPDATE_INSTALLED, 
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE, 
                                ServerUtil.TestMessage.NOTIFY_APP_READY_SUCCESS]);
                        })
                        .then<void>(() => {
                            /* run the app again to ensure it was not reverted */
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE, 
                                ServerUtil.TestMessage.NOTIFY_APP_READY_SUCCESS]);
                        })
                        .done(() => { done(); }, () => { done(); });
                }, false),
            
            new PluginTestingFramework.TestBuilderIt("localPackage.install.immediately",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    /* create an update */
                    PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateNotifyApplicationReady, "Update 1")
                        .then<void>((updatePath: string) => {
                            PluginTestingFramework.updatePackagePath = updatePath;
                            projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                            return PluginTestingFramework.expectTestMessages([
                                ServerUtil.TestMessage.UPDATE_INSTALLED, 
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE, 
                                ServerUtil.TestMessage.NOTIFY_APP_READY_SUCCESS]);
                        })
                        .then<void>(() => {
                            /* run the app again to ensure it was not reverted */
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE, 
                                ServerUtil.TestMessage.NOTIFY_APP_READY_SUCCESS]);
                        })
                        .done(() => { done(); }, () => { done(); });
                }, false)
        ], ScenarioInstall),
        
    new PluginTestingFramework.TestBuilderDescribe("#localPackage.install.revert",
    
        [
            new PluginTestingFramework.TestBuilderIt("localPackage.install.revert.dorevert",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    /* create an update */
                    PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateDeviceReady, "Update 1 (bad update)")
                        .then<void>((updatePath: string) => {
                            PluginTestingFramework.updatePackagePath = updatePath;
                            projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                            return PluginTestingFramework.expectTestMessages([
                                ServerUtil.TestMessage.UPDATE_INSTALLED, 
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE]);
                        })
                        .then<void>(() => {
                            /* run the app again to ensure it was reverted */
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.UPDATE_FAILED_PREVIOUSLY]);
                        })
                        .then<void>(() => {
                            /* create a second failed update */
                            console.log("Creating a second failed update.");
                            PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([
                                ServerUtil.TestMessage.UPDATE_INSTALLED, 
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE]);
                        })
                        .then<void>(() => {
                            /* run the app again to ensure it was reverted */
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.UPDATE_FAILED_PREVIOUSLY]);
                        })
                        .done(() => { done(); }, () => { done(); });
                }, false),
            
            new PluginTestingFramework.TestBuilderIt("localPackage.install.revert.norevert",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    /* create an update */
                    PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateNotifyApplicationReady, "Update 1 (good update)")
                        .then<void>((updatePath: string) => {
                            PluginTestingFramework.updatePackagePath = updatePath;
                            projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                            return PluginTestingFramework.expectTestMessages([
                                ServerUtil.TestMessage.UPDATE_INSTALLED, 
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE, 
                                ServerUtil.TestMessage.NOTIFY_APP_READY_SUCCESS]);
                        })
                        .then<void>(() => {
                            /* run the app again to ensure it was not reverted */
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE, 
                                ServerUtil.TestMessage.NOTIFY_APP_READY_SUCCESS]);
                        })
                        .done(() => { done(); }, () => { done(); });
                }, false)
        ], ScenarioInstallWithRevert),
    
    new PluginTestingFramework.TestBuilderDescribe("#localPackage.installOnNextResume",
    
        [
            new PluginTestingFramework.TestBuilderIt("localPackage.installOnNextResume.dorevert",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateDeviceReady, "Update 1")
                        .then<void>((updatePath: string) => {
                            PluginTestingFramework.updatePackagePath = updatePath;
                            projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                            return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.UPDATE_INSTALLED]);
                        })
                        .then<void>(() => {
                            /* resume the application */
                            targetPlatform.getEmulatorManager().resumeApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE]);
                        })
                        .then<void>(() => {
                            /* restart to revert it */
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.UPDATE_FAILED_PREVIOUSLY]);
                        })
                        .done(() => { done(); }, () => { done(); });
                }, true),
            
            new PluginTestingFramework.TestBuilderIt("localPackage.installOnNextResume.norevert",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    /* create an update */
                    PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateNotifyApplicationReady, "Update 1 (good update)")
                        .then<void>((updatePath: string) => {
                            PluginTestingFramework.updatePackagePath = updatePath;
                            projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                            return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.UPDATE_INSTALLED]);
                        })
                        .then<void>(() => {
                            /* resume the application */
                            targetPlatform.getEmulatorManager().resumeApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE, 
                                ServerUtil.TestMessage.NOTIFY_APP_READY_SUCCESS]);
                        })
                        .then<void>(() => {
                            /* restart to make sure it did not revert */
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE, 
                                ServerUtil.TestMessage.NOTIFY_APP_READY_SUCCESS]);
                        })
                        .done(() => { done(); }, () => { done(); });
                }, true)
        ], ScenarioInstallOnResumeWithRevert),
        
    new PluginTestingFramework.TestBuilderDescribe("localPackage installOnNextRestart",
    
        [
            new PluginTestingFramework.TestBuilderIt("localPackage.installOnNextRestart.dorevert",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateDeviceReady, "Update 1")
                        .then<void>((updatePath: string) => {
                            PluginTestingFramework.updatePackagePath = updatePath;
                            projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                            return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.UPDATE_INSTALLED]);
                        })
                        .then<void>(() => {
                            /* restart the application */
                            console.log("Update hash: " + PluginTestingFramework.updateResponse.updateInfo.packageHash);
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE]);
                        })
                        .then<void>(() => {
                            /* restart the application */
                            console.log("Update hash: " + PluginTestingFramework.updateResponse.updateInfo.packageHash);
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.UPDATE_FAILED_PREVIOUSLY]);
                        })
                        .done(() => { done(); }, () => { done(); });
                }, false),
            
            new PluginTestingFramework.TestBuilderIt("localPackage.installOnNextRestart.norevert",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    /* create an update */
                    PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateNotifyApplicationReady, "Update 1 (good update)")
                        .then<void>((updatePath: string) => {
                            PluginTestingFramework.updatePackagePath = updatePath;
                            projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                            return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.UPDATE_INSTALLED]);
                        })
                        .then<void>(() => {
                            /* "resume" the application - run it again */
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE, 
                                ServerUtil.TestMessage.NOTIFY_APP_READY_SUCCESS]);
                        })
                        .then<void>(() => {
                            /* run again to make sure it did not revert */
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE, 
                                ServerUtil.TestMessage.NOTIFY_APP_READY_SUCCESS]);
                        })
                        .done(() => { done(); }, () => { done(); });
                }, true),
            
            new PluginTestingFramework.TestBuilderIt("localPackage.installOnNextRestart.revertToPrevious",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    /* create an update */
                    PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateNotifyApplicationReadyConditional, "Update 1 (good update)")
                        .then<void>((updatePath: string) => {
                            PluginTestingFramework.updatePackagePath = updatePath;
                            projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                            return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.UPDATE_INSTALLED]);
                        })
                        .then<void>(() => {
                            /* run good update, set up another (bad) update */
                            PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };
                            PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateDeviceReady, "Update 2 (bad update)")
                                .then(() => { return targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace); });
                            return PluginTestingFramework.expectTestMessages([
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE, 
                                ServerUtil.TestMessage.NOTIFY_APP_READY_SUCCESS, ServerUtil.TestMessage.UPDATE_INSTALLED]);
                        })
                        .then<void>(() => {
                            /* run the bad update without calling notifyApplicationReady */
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE]);
                        })
                        .then<void>(() => {
                            /* run the good update and don't call notifyApplicationReady - it should not revert */
                            PluginTestingFramework.testMessageResponse = ServerUtil.TestMessageResponse.SKIP_NOTIFY_APPLICATION_READY;
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE, 
                                ServerUtil.TestMessage.SKIPPED_NOTIFY_APPLICATION_READY]);
                        })
                        .then<void>(() => {
                            /* run the application again */
                            PluginTestingFramework.testMessageResponse = undefined;
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE, 
                                ServerUtil.TestMessage.NOTIFY_APP_READY_SUCCESS, 
                                ServerUtil.TestMessage.UPDATE_FAILED_PREVIOUSLY]);
                        })
                        .done(() => { done(); }, () => { done(); });
                }, false)
        ], ScenarioInstallOnRestartWithRevert),
        
    new PluginTestingFramework.TestBuilderDescribe("#codePush.restartApplication",
    
        [
            new PluginTestingFramework.TestBuilderIt("codePush.restartApplication.checkPackages",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateNotifyApplicationReady, "Update 1")
                        .then<void>((updatePath: string) => {
                            PluginTestingFramework.updatePackagePath = updatePath;
                            projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                            return PluginTestingFramework.expectTestMessages([
                                new ServerUtil.AppMessage(ServerUtil.TestMessage.PENDING_PACKAGE, [null]),
                                new ServerUtil.AppMessage(ServerUtil.TestMessage.CURRENT_PACKAGE, [null]),
                                new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                                new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_INSTALLING_UPDATE]),
                                new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_UPDATE_INSTALLED]),
                                new ServerUtil.AppMessage(ServerUtil.TestMessage.PENDING_PACKAGE, [PluginTestingFramework.updateResponse.updateInfo.packageHash]),
                                new ServerUtil.AppMessage(ServerUtil.TestMessage.CURRENT_PACKAGE, [null]),
                                ServerUtil.TestMessage.RESTART_SUCCEEDED,
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE,
                                ServerUtil.TestMessage.NOTIFY_APP_READY_SUCCESS]);
                        })
                        .then<void>(() => {
                            /* restart the application */
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE, 
                                ServerUtil.TestMessage.NOTIFY_APP_READY_SUCCESS]);
                        })
                        .done(() => { done(); }, () => { done(); });
                }, true)
        ], ScenarioRestart),
        
    new PluginTestingFramework.TestBuilderDescribe("#window.codePush.sync",
        [
            // We test the functionality with sync twice--first, with sync only called once,
            // then, with sync called again while the first sync is still running.
            new PluginTestingFramework.TestBuilderDescribe("#window.codePush.sync 1x",
                [
                    // Tests where sync is called just once
                    new PluginTestingFramework.TestBuilderIt("window.codePush.sync.noupdate",
                        (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                            var noUpdateResponse = PluginTestingFramework.createDefaultResponse();
                            noUpdateResponse.isAvailable = false;
                            noUpdateResponse.appVersion = "0.0.1";
                            PluginTestingFramework.updateResponse = { updateInfo: noUpdateResponse };

                            Q({})
                                .then<void>(p => {
                                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                                    return PluginTestingFramework.expectTestMessages([
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_UP_TO_DATE])]);
                                })
                                .done(() => { done(); }, () => { done(); });
                        }, false),
                    
                    new PluginTestingFramework.TestBuilderIt("window.codePush.sync.checkerror",
                        (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                            PluginTestingFramework.updateResponse = "invalid {{ json";

                            Q({})
                                .then<void>(p => {
                                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                                    return PluginTestingFramework.expectTestMessages([
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_ERROR])]);
                                })
                                .done(() => { done(); }, () => { done(); });
                        }, false),
                    
                    new PluginTestingFramework.TestBuilderIt("window.codePush.sync.downloaderror",
                        (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                            var invalidUrlResponse = PluginTestingFramework.createUpdateResponse();
                            invalidUrlResponse.downloadURL = path.join(PluginTestingFramework.templatePath, "invalid_path.zip");
                            PluginTestingFramework.updateResponse = { updateInfo: invalidUrlResponse };

                            Q({})
                                .then<void>(p => {
                                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                                    return PluginTestingFramework.expectTestMessages([
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_ERROR])]);
                                })
                                .done(() => { done(); }, () => { done(); });
                        }, false),
                    
                    new PluginTestingFramework.TestBuilderIt("window.codePush.sync.dorevert",
                        (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                            PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };
                        
                            /* create an update */
                            PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateDeviceReady, "Update 1 (bad update)")
                                .then<void>((updatePath: string) => {
                                    PluginTestingFramework.updatePackagePath = updatePath;
                                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                                    return PluginTestingFramework.expectTestMessages([
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_INSTALLING_UPDATE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_UPDATE_INSTALLED]),
                                        ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE]);
                                })
                                .then<void>(() => {
                                    targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                                    return PluginTestingFramework.expectTestMessages([
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_UP_TO_DATE])]);
                                })
                                .done(() => { done(); }, () => { done(); });
                        }, false),
                    
                    new PluginTestingFramework.TestBuilderIt("window.codePush.sync.update",
                        (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                            PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                            /* create an update */
                            PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateSync, "Update 1 (good update)")
                                .then<void>((updatePath: string) => {
                                    PluginTestingFramework.updatePackagePath = updatePath;
                                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                                    return PluginTestingFramework.expectTestMessages([
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_INSTALLING_UPDATE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_UPDATE_INSTALLED]),
                                        // the update is immediate so the update will install
                                        ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE]);
                                })
                                .then<void>(() => {
                                    // restart the app and make sure it didn't roll out!
                                    var noUpdateResponse = PluginTestingFramework.createDefaultResponse();
                                    noUpdateResponse.isAvailable = false;
                                    noUpdateResponse.appVersion = "0.0.1";
                                    PluginTestingFramework.updateResponse = { updateInfo: noUpdateResponse };
                                    targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                                    return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE]);
                                })
                                .done(() => { done(); }, () => { done(); });
                        }, false)
                    
                ], ScenarioSync1x),
                
            new PluginTestingFramework.TestBuilderDescribe("#window.codePush.sync 2x",
                [
                    // Tests where sync is called again before the first sync finishes
                    new PluginTestingFramework.TestBuilderIt("window.codePush.sync.2x.noupdate",
                        (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                            var noUpdateResponse = PluginTestingFramework.createDefaultResponse();
                            noUpdateResponse.isAvailable = false;
                            noUpdateResponse.appVersion = "0.0.1";
                            PluginTestingFramework.updateResponse = { updateInfo: noUpdateResponse };

                            Q({})
                                .then<void>(p => {
                                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                                    return PluginTestingFramework.expectTestMessages([
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_IN_PROGRESS]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_UP_TO_DATE])]);
                                })
                                .done(() => { done(); }, () => { done(); });
                        }, false),
                    
                    new PluginTestingFramework.TestBuilderIt("window.codePush.sync.2x.checkerror",
                        (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                            PluginTestingFramework.updateResponse = "invalid {{ json";

                            Q({})
                                .then<void>(p => {
                                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                                    return PluginTestingFramework.expectTestMessages([
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_IN_PROGRESS]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_ERROR])]);
                                })
                                .done(() => { done(); }, () => { done(); });
                        }, false),
                    
                    new PluginTestingFramework.TestBuilderIt("window.codePush.sync.2x.downloaderror",
                        (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                            var invalidUrlResponse = PluginTestingFramework.createUpdateResponse();
                            invalidUrlResponse.downloadURL = path.join(PluginTestingFramework.templatePath, "invalid_path.zip");
                            PluginTestingFramework.updateResponse = { updateInfo: invalidUrlResponse };

                            Q({})
                                .then<void>(p => {
                                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                                    return PluginTestingFramework.expectTestMessages([
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_IN_PROGRESS]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_ERROR])]);
                                })
                                .done(() => { done(); }, () => { done(); });
                        }, false),
                    
                    new PluginTestingFramework.TestBuilderIt("window.codePush.sync.2x.dorevert",
                        (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                            PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };
                    
                            /* create an update */
                            PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateDeviceReady, "Update 1 (bad update)")
                                .then<void>((updatePath: string) => {
                                    PluginTestingFramework.updatePackagePath = updatePath;
                                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                                    return PluginTestingFramework.expectTestMessages([
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_IN_PROGRESS]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_INSTALLING_UPDATE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_UPDATE_INSTALLED]),
                                        ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE]);
                                })
                                .then<void>(() => {
                                    targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                                    return PluginTestingFramework.expectTestMessages([
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_IN_PROGRESS]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_UP_TO_DATE])]);
                                })
                                .done(() => { done(); }, () => { done(); });
                        }, false),
                    
                    new PluginTestingFramework.TestBuilderIt("window.codePush.sync.2x.update",
                        (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                            PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                            /* create an update */
                            PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateSync2x, "Update 1 (good update)")
                                .then<void>((updatePath: string) => {
                                    PluginTestingFramework.updatePackagePath = updatePath;
                                    projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                                    return PluginTestingFramework.expectTestMessages([
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_IN_PROGRESS]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_INSTALLING_UPDATE]),
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_UPDATE_INSTALLED]),
                                        // the update is immediate so the update will install
                                        ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE,
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_IN_PROGRESS])]);
                                })
                                .then<void>(() => {
                                    // restart the app and make sure it didn't roll out!
                                    var noUpdateResponse = PluginTestingFramework.createDefaultResponse();
                                    noUpdateResponse.isAvailable = false;
                                    noUpdateResponse.appVersion = "0.0.1";
                                    PluginTestingFramework.updateResponse = { updateInfo: noUpdateResponse };
                                    targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                                    return PluginTestingFramework.expectTestMessages([
                                        ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE,
                                        new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_IN_PROGRESS])]);
                                })
                                .done(() => { done(); }, () => { done(); });
                        }, true)
                ], ScenarioSync2x)
        ]),
    
    new PluginTestingFramework.TestBuilderDescribe("#window.codePush.sync minimum background duration tests",
    
        [
            new PluginTestingFramework.TestBuilderIt("defaults to no minimum",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    PluginTestingFramework.setupScenario(projectManager, targetPlatform, ScenarioSyncResume).then<string>(() => {
                            return PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateSync, "Update 1 (good update)");
                        })
                        .then<void>((updatePath: string) => {
                            PluginTestingFramework.updatePackagePath = updatePath;
                            projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                            return PluginTestingFramework.expectTestMessages([
                                new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_UPDATE_INSTALLED])]);
                        })
                        .then<void>(() => {
                            var noUpdateResponse = PluginTestingFramework.createDefaultResponse();
                            noUpdateResponse.isAvailable = false;
                            noUpdateResponse.appVersion = "0.0.1";
                            PluginTestingFramework.updateResponse = { updateInfo: noUpdateResponse };
                            targetPlatform.getEmulatorManager().resumeApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE]);
                        })
                        .done(() => { done(); }, () => { done(); });
                }, false),
            
            new PluginTestingFramework.TestBuilderIt("min background duration 5s",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    PluginTestingFramework.setupScenario(projectManager, targetPlatform, ScenarioSyncResumeDelay).then<string>(() => {
                            return PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateSync, "Update 1 (good update)");
                        })
                        .then<void>((updatePath: string) => {
                            PluginTestingFramework.updatePackagePath = updatePath;
                            projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                            return PluginTestingFramework.expectTestMessages([
                                new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_UPDATE_INSTALLED])]);
                        })
                        .then<string>(() => {
                            var noUpdateResponse = PluginTestingFramework.createDefaultResponse();
                            noUpdateResponse.isAvailable = false;
                            noUpdateResponse.appVersion = "0.0.1";
                            PluginTestingFramework.updateResponse = { updateInfo: noUpdateResponse };
                            return targetPlatform.getEmulatorManager().resumeApplication(PluginTestingFramework.TestNamespace, 3 * 1000);
                        })
                        .then<void>(() => {
                            targetPlatform.getEmulatorManager().resumeApplication(PluginTestingFramework.TestNamespace, 6 * 1000);
                            return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE]);
                        })
                        .done(() => { done(); }, () => { done(); });
                }, false),
                
            new PluginTestingFramework.TestBuilderIt("has no effect on restart",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    PluginTestingFramework.setupScenario(projectManager, targetPlatform, ScenarioSyncRestartDelay).then<string>(() => {
                            return PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateSync, "Update 1 (good update)");
                        })
                        .then<void>((updatePath: string) => {
                            PluginTestingFramework.updatePackagePath = updatePath;
                            projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                            return PluginTestingFramework.expectTestMessages([
                                new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_UPDATE_INSTALLED])]);
                        })
                        .then<void>(() => {
                            var noUpdateResponse = PluginTestingFramework.createDefaultResponse();
                            noUpdateResponse.isAvailable = false;
                            noUpdateResponse.appVersion = "0.0.1";
                            PluginTestingFramework.updateResponse = { updateInfo: noUpdateResponse };
                            targetPlatform.getEmulatorManager().restartApplication(PluginTestingFramework.TestNamespace);
                            return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE]);
                        })
                        .done(() => { done(); }, () => { done(); });
                }, false)
        ]),
        
    new PluginTestingFramework.TestBuilderDescribe("#window.codePush.sync mandatory install mode tests",
    
        [
            new PluginTestingFramework.TestBuilderIt("defaults to IMMEDIATE",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(true, targetPlatform) };

                    PluginTestingFramework.setupScenario(projectManager, targetPlatform, ScenarioSyncMandatoryDefault).then<string>(() => {
                            return PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateDeviceReady, "Update 1 (good update)");
                        })
                        .then<void>((updatePath: string) => {
                            PluginTestingFramework.updatePackagePath = updatePath;
                            projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                            return PluginTestingFramework.expectTestMessages([
                                new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_UPDATE_INSTALLED]),
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE]);
                        })
                        .done(() => { done(); }, () => { done(); });
                }, false),
                
            new PluginTestingFramework.TestBuilderIt("works correctly when update is mandatory and mandatory install mode is specified",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(true, targetPlatform) };

                    PluginTestingFramework.setupScenario(projectManager, targetPlatform, ScenarioSyncMandatoryResume).then<string>(() => {
                            return PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateDeviceReady, "Update 1 (good update)");
                        })
                        .then<void>((updatePath: string) => {
                            PluginTestingFramework.updatePackagePath = updatePath;
                            projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                            return PluginTestingFramework.expectTestMessages([
                                new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_UPDATE_INSTALLED])]);
                        })
                        .then<void>(() => {
                            var noUpdateResponse = PluginTestingFramework.createDefaultResponse();
                            noUpdateResponse.isAvailable = false;
                            noUpdateResponse.appVersion = "0.0.1";
                            PluginTestingFramework.updateResponse = { updateInfo: noUpdateResponse };
                            targetPlatform.getEmulatorManager().resumeApplication(PluginTestingFramework.TestNamespace, 5 * 1000);
                            return PluginTestingFramework.expectTestMessages([ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE]);
                        })
                        .done(() => { done(); }, () => { done(); });
                }, false),
                
            new PluginTestingFramework.TestBuilderIt("has no effect on updates that are not mandatory",
                (projectManager: ProjectManager, targetPlatform: Platform.IPlatform, done: MochaDone) => {
                    PluginTestingFramework.updateResponse = { updateInfo: PluginTestingFramework.createUpdateResponse(false, targetPlatform) };

                    PluginTestingFramework.setupScenario(projectManager, targetPlatform, ScenarioSyncMandatoryRestart).then<string>(() => {
                            return PluginTestingFramework.createUpdate(projectManager, targetPlatform, UpdateDeviceReady, "Update 1 (good update)");
                        })
                        .then<void>((updatePath: string) => {
                            PluginTestingFramework.updatePackagePath = updatePath;
                            projectManager.runApplication(PluginTestingFramework.testRunDirectory, targetPlatform);
                            return PluginTestingFramework.expectTestMessages([
                                new ServerUtil.AppMessage(ServerUtil.TestMessage.SYNC_STATUS, [ServerUtil.TestMessage.SYNC_UPDATE_INSTALLED]),
                                ServerUtil.TestMessage.DEVICE_READY_AFTER_UPDATE]);
                        })
                        .done(() => { done(); }, () => { done(); });
                }, false)
        ])
];

// Create tests.
PluginTestingFramework.initializeTests(new CordovaProjectManager(), testBuilderDescribes, supportedPlatforms);

/* describe("run server", function() {
    this.timeout(60 * 60 * 1000);
    
    it("runs server", (done: MochaDone) => {
        PluginTestingFramework.setupServer(Platform.IOS.getInstance());
    });
}); */
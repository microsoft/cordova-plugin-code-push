/// <reference path="../typings/mocha.d.ts" />
/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/assert.d.ts" />
/// <reference path="../typings/codePush.d.ts" />

"use strict";

import tm = require("./projectManager");
import tu = require("./testUtil");
import su = require("./serverUtil");
import platform = require("./platform");
import path = require("path");
import os = require("os");
import assert = require("assert");
import Q = require("q");

var express = require("express");
var bodyparser = require("body-parser");
var projectManager = tm.ProjectManager;
var testUtil = tu.TestUtil;

var templatePath = path.join(__dirname, "../../test/template");
var thisPluginPath = path.join(__dirname, "../..");
var testRunDirectory = path.join(os.tmpdir(), "cordova-plugin-code-push", "test-run");
var updatesDirectory = path.join(os.tmpdir(), "cordova-plugin-code-push", "updates");
var serverUrl = testUtil.readMockServerName();
var targetEmulator = testUtil.readTargetEmulator();
var targetPlatform: platform.IPlatform = platform.PlatformResolver.resolvePlatform(testUtil.readTargetPlatform());
var shouldUseWkWebView = testUtil.readShouldUseWkWebView();

const TestAppName = "TestCodePush";
const TestNamespace = "com.microsoft.codepush.test";
const AcquisitionSDKPluginName = "code-push";
const WkWebViewEnginePluginName = "cordova-plugin-wkwebview-engine";

const ScenarioCheckForUpdatePath = "js/scenarioCheckForUpdate.js";
const ScenarioCheckForUpdateCustomKey = "js/scenarioCheckForUpdateCustomKey.js";
const ScenarioDownloadUpdate = "js/scenarioDownloadUpdate.js";
const ScenarioInstall = "js/scenarioInstall.js";
const ScenarioInstallOnResumeWithRevert = "js/scenarioInstallOnResumeWithRevert.js";
const ScenarioInstallOnRestartWithRevert = "js/scenarioInstallOnRestartWithRevert.js";
const ScenarioInstallWithRevert = "js/scenarioInstallWithRevert.js";
const ScenarioSync1x = "js/scenarioSync.js";
const ScenarioSyncResume = "js/scenarioSyncResume.js";
const ScenarioSyncResume30 = "js/scenarioSyncResume30.js";
const ScenarioSyncRestart30 = "js/scenarioSyncResume30.js";
const ScenarioSync2x = "js/scenarioSync2x.js";
const ScenarioRestart = "js/scenarioRestart.js";

const UpdateDeviceReady = "js/updateDeviceReady.js";
const UpdateNotifyApplicationReady = "js/updateNotifyApplicationReady.js";
const UpdateSync = "js/updateSync.js";
const UpdateSync2x = "js/updateSync2x.js";
const UpdateNotifyApplicationReadyConditional = "js/updateNARConditional.js";

var app: any;
var server: any;
var mockResponse: any;
var testMessageResponse: any;
var testMessageCallback: (requestBody: any) => void;
var updateCheckCallback: (requestBody: any) => void;
var mockUpdatePackagePath: string;

function cleanupScenario() {
    if (server) {
        server.close();
        server = undefined;
    }
}

function setupScenario(scenarioPath: string): Q.Promise<void> {
    console.log("\nScenario: " + scenarioPath);
    console.log("Mock server url: " + serverUrl);
    console.log("Target platform: " + targetPlatform ? targetPlatform.getCordovaName() : "");
    console.log("Target emulator: " + targetEmulator);

    app = express();
    app.use(bodyparser.json());
    app.use(bodyparser.urlencoded({ extended: true }));
    
    app.use(function(req: any, res: any, next: any) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "*");
        res.setHeader("Access-Control-Allow-Headers", "origin, content-type, accept");
        next();
    });

    app.get("/updateCheck", function(req: any, res: any) {
        updateCheckCallback && updateCheckCallback(req);
        res.send(mockResponse);
        console.log("Update check called from the app.");
        console.log("Request: " + JSON.stringify(req.query));
    });

    app.get("/download", function(req: any, res: any) {
        res.download(mockUpdatePackagePath);
    });

    app.post("/reportTestMessage", function(req: any, res: any) {
        console.log("Application reported a test message.");
        console.log("Body: " + JSON.stringify(req.body));

        if (!testMessageResponse) {
            console.log("Sending OK");
            res.sendStatus(200);
        } else {
            console.log("Sending body: " + testMessageResponse);
            res.status(200).send(testMessageResponse);
        }

        testMessageCallback && testMessageCallback(req.body);
    });

    server = app.listen(3000);

    return projectManager.setupTemplate(
        testRunDirectory, templatePath, serverUrl,
        platform.Android.getInstance().getDefaultDeploymentKey(),
        platform.IOS.getInstance().getDefaultDeploymentKey(),
        TestAppName, TestNamespace, scenarioPath)
        .then<void>(() => { return projectManager.addPlatform(testRunDirectory, targetPlatform); })
        .then<void>(() => { return projectManager.addPlugin(testRunDirectory, AcquisitionSDKPluginName); })
        .then<void>(() => { return projectManager.addPlugin(testRunDirectory, thisPluginPath); })
        .then<void>(() => { return (shouldUseWkWebView ? projectManager.addPlugin(testRunDirectory, WkWebViewEnginePluginName) : null); })
        .then<void>(() => { return projectManager.buildPlatform(testRunDirectory, targetPlatform); });
}

function createDefaultResponse(): su.CheckForUpdateResponseMock {
    var defaultResponse = new su.CheckForUpdateResponseMock();

    defaultResponse.downloadURL = "";
    defaultResponse.description = "";
    defaultResponse.isAvailable = false;
    defaultResponse.isMandatory = false;
    defaultResponse.appVersion = "";
    defaultResponse.packageHash = "";
    defaultResponse.label = "";
    defaultResponse.packageSize = 0;
    defaultResponse.updateAppVersion = false;

    return defaultResponse;
}

function createMockResponse(): su.CheckForUpdateResponseMock {
    var updateResponse = new su.CheckForUpdateResponseMock();
    updateResponse.isAvailable = true;
    updateResponse.appVersion = "1.0.0";
    updateResponse.downloadURL = "mock.url/download";
    updateResponse.isMandatory = true;
    updateResponse.label = "mock-update";
    updateResponse.packageHash = "12345-67890";
    updateResponse.packageSize = 12345;
    updateResponse.updateAppVersion = false;

    return updateResponse;
}

var getMockResponse = (randomHash: boolean): su.CheckForUpdateResponseMock => {
    var updateResponse = createMockResponse();
    updateResponse.downloadURL = serverUrl + "/download";
    /* for some tests we need unique hashes to avoid conflicts - the application is not uninstalled between tests
       and we store the failed hashes in preferences */
    if (randomHash) {
        updateResponse.packageHash = "randomHash-" + Math.floor(Math.random() * 10000);
    }
    return updateResponse;
};

function setupUpdateProject(scenarioPath: string, version: string): Q.Promise<void> {
    console.log("Creating an update at location: " + updatesDirectory);
    return projectManager.setupTemplate(updatesDirectory, templatePath, serverUrl,
        platform.Android.getInstance().getDefaultDeploymentKey(),
        platform.IOS.getInstance().getDefaultDeploymentKey(),
        TestAppName, TestNamespace, scenarioPath, version)
        .then<void>(() => { return projectManager.addPlatform(updatesDirectory, targetPlatform); })
        .then<void>(() => { return projectManager.addPlugin(testRunDirectory, AcquisitionSDKPluginName); })
        .then<void>(() => { return projectManager.addPlugin(updatesDirectory, thisPluginPath); })
        .then<void>(() => { return (shouldUseWkWebView ? projectManager.addPlugin(testRunDirectory, WkWebViewEnginePluginName) : null); })
        .then<void>(() => { return projectManager.preparePlatform(updatesDirectory, targetPlatform); });
};

function verifyMessages(expectedMessages: (string | su.AppMessage)[], deferred: Q.Deferred<void>): (requestBody: any) => void {
    var messageIndex = 0;
    return (requestBody: su.AppMessage) => {
        try {
            console.log("Message index: " + messageIndex);
            if (typeof expectedMessages[messageIndex] === "string") {
                assert.equal(expectedMessages[messageIndex], requestBody.message);
            }
            else {
                assert(su.areEqual(<su.AppMessage>expectedMessages[messageIndex], requestBody));
            }
            /* end of message array */
            if (++messageIndex === expectedMessages.length) {
                deferred.resolve(undefined);
            }
        } catch (e) {
            deferred.reject(e);
        }
    };
};

describe("window.codePush", function() {

    this.timeout(100 * 60 * 1000);
    
    /* clean up */
    afterEach(() => {
        console.log("Cleaning up!");
        mockResponse = undefined;
        testMessageCallback = undefined;
        updateCheckCallback = undefined;
        testMessageResponse = undefined;
    });

    describe("#window.codePush.checkForUpdate", function() {

        before(() => {
            return setupScenario(ScenarioCheckForUpdatePath);
        });

        after(() => {
            cleanupScenario();
        });
        
        it("window.codePush.checkForUpdate.noUpdate", function(done) {
            var noUpdateResponse = createDefaultResponse();
            noUpdateResponse.isAvailable = false;
            noUpdateResponse.appVersion = "0.0.1";

            mockResponse = { updateInfo: noUpdateResponse };

            testMessageCallback = (requestBody: any) => {
                try {
                    assert.equal(su.TestMessage.CHECK_UP_TO_DATE, requestBody.message);
                    done();
                } catch (e) {
                    done(e);
                }
            };

            console.log("Running project...");
            projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
        });

        it("window.codePush.checkForUpdate.sendsBinaryHash", function(done) {
            var noUpdateResponse = createDefaultResponse();
            noUpdateResponse.isAvailable = false;
            noUpdateResponse.appVersion = "0.0.1";

            updateCheckCallback = (request: any) => {
                try {
                    assert(request.query.packageHash);
                } catch (e) {
                    done(e);
                }
            };
            
            mockResponse = { updateInfo: noUpdateResponse };

            testMessageCallback = (requestBody: any) => {
                try {
                    assert.equal(su.TestMessage.CHECK_UP_TO_DATE, requestBody.message);
                    done();
                } catch (e) {
                    done(e);
                }
            };

            console.log("Running project...");
            projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
        });
        
        it("window.codePush.checkForUpdate.noUpdate.updateAppVersion", function(done) {
            var updateAppVersionResponse = createDefaultResponse();
            updateAppVersionResponse.updateAppVersion = true;
            updateAppVersionResponse.appVersion = "2.0.0";

            mockResponse = { updateInfo: updateAppVersionResponse };

            testMessageCallback = (requestBody: any) => {
                try {
                    assert.equal(su.TestMessage.CHECK_UP_TO_DATE, requestBody.message);
                    done();
                } catch (e) {
                    done(e);
                }
            };

            console.log("Running project...");
            projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
        });

        it("window.codePush.checkForUpdate.update", function(done) {
            var updateResponse = createMockResponse();
            mockResponse = { updateInfo: updateResponse };

            testMessageCallback = (requestBody: any) => {
                try {
                    assert.equal(su.TestMessage.CHECK_UPDATE_AVAILABLE, requestBody.message);
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

            updateCheckCallback = (request: any) => {
                try {
                    assert.notEqual(null, request);
                    assert.equal(request.query.deploymentKey, targetPlatform.getDefaultDeploymentKey());
                } catch (e) {
                    done(e);
                }
            };

            console.log("Running project...");
            projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
        });

        it("window.codePush.checkForUpdate.error", function(done) {
            mockResponse = "invalid {{ json";

            testMessageCallback = (requestBody: any) => {
                try {
                    assert.equal(su.TestMessage.CHECK_ERROR, requestBody.message);
                    done();
                } catch (e) {
                    done(e);
                }
            };

            console.log("Running project...");
            projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
        });
    });

    describe("#window.codePush.checkForUpdate.customKey", function() {

        before(() => {
            return setupScenario(ScenarioCheckForUpdateCustomKey);
        });

        after(() => {
            cleanupScenario();
        });

        it("window.codePush.checkForUpdate.customKey.update", function(done) {
            var updateResponse = createMockResponse();
            mockResponse = { updateInfo: updateResponse };

            updateCheckCallback = (request: any) => {
                try {
                    assert.notEqual(null, request);
                    assert.equal(request.query.deploymentKey, "CUSTOM-DEPLOYMENT-KEY");
                    done();
                } catch (e) {
                    done(e);
                }
            };

            console.log("Running project...");
            projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
        });
    });


    describe("#remotePackage.download", function() {

        before(() => {
            return setupScenario(ScenarioDownloadUpdate);
        });

        after(() => {
            cleanupScenario();
        });

        var getMockResponse = (): su.CheckForUpdateResponseMock => {
            var updateResponse = createMockResponse();
            updateResponse.downloadURL = serverUrl + "/download";
            return updateResponse;
        };

        it("remotePackage.download.success", function(done) {
            mockResponse = { updateInfo: getMockResponse() };

            /* pass the path to any file for download (here, config.xml) to make sure the download completed callback is invoked */
            mockUpdatePackagePath = path.join(templatePath, "config.xml");

            testMessageCallback = (requestBody: any) => {
                try {
                    assert.equal(su.TestMessage.DOWNLOAD_SUCCEEDED, requestBody.message);
                    done();
                } catch (e) {
                    done(e);
                }
            };

            console.log("Running project...");
            projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
        });

        it("remotePackage.download.error", function(done) {
            mockResponse = { updateInfo: getMockResponse() };

            /* pass an invalid path */
            mockUpdatePackagePath = path.join(templatePath, "invalid_path.zip");

            testMessageCallback = (requestBody: any) => {
                try {
                    assert.equal(su.TestMessage.DOWNLOAD_ERROR, requestBody.message);
                    done();
                } catch (e) {
                    done(e);
                }
            };

            console.log("Running project...");
            projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
        });
    });

    describe("#localPackage.install", function() {

        after(() => {
            cleanupScenario();
        });

        before(() => {
            return setupScenario(ScenarioInstall);
        });

        var getMockResponse = (): su.CheckForUpdateResponseMock => {
            var updateResponse = createMockResponse();
            updateResponse.downloadURL = serverUrl + "/download";
            return updateResponse;
        };

        it("localPackage.install.unzip.error", function(done) {

            mockResponse = { updateInfo: getMockResponse() };

            /* pass an invalid zip file, here, config.xml */
            mockUpdatePackagePath = path.join(templatePath, "config.xml");

            testMessageCallback = (requestBody: any) => {
                try {
                    assert.equal(su.TestMessage.INSTALL_ERROR, requestBody.message);
                    done();
                } catch (e) {
                    done(e);
                }
            };

            console.log("Running project...");
            projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
        });

        it("localPackage.install.handlesDiff.againstBinary", function(done) {

            mockResponse = { updateInfo: getMockResponse() };

            /* create an update */
            setupUpdateProject(UpdateNotifyApplicationReady, "Diff Update 1")
                .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform, /*isDiff*/ true))
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED, su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* run the app again to ensure it was not reverted */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                    console.log("Restarting application...");
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator);
                    return deferred.promise;
                })
                .done(done, done);
        });
        
        it("localPackage.install.immediately", function(done) {

            mockResponse = { updateInfo: getMockResponse() };

            /* create an update */
            setupUpdateProject(UpdateNotifyApplicationReady, "Update 1")
                .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED, su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* run the app again to ensure it was not reverted */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                    console.log("Restarting application...");
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator);
                    return deferred.promise;
                })
                .done(done, done);
        });
    });

    describe("#localPackage.install.revert", function() {

        after(() => {
            cleanupScenario();
        });

        before(() => {
            return setupScenario(ScenarioInstallWithRevert);
        });

        it("localPackage.install.revert.dorevert", function(done) {

            mockResponse = { updateInfo: getMockResponse(false) };

            /* create an update */
            setupUpdateProject(UpdateDeviceReady, "Update 1 (bad update)")
                .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED, su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* run the app again to ensure it was reverted */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.UPDATE_FAILED_PREVIOUSLY], deferred);
                    console.log("Restarting application...");
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator);
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* create a second failed update */
                    console.log("Creating a second failed update.");
                    var deferred = Q.defer<void>();
                    mockResponse = { updateInfo: getMockResponse(true) };
                    testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED, su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* run the app again to ensure it was reverted */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.UPDATE_FAILED_PREVIOUSLY], deferred);
                    console.log("Restarting application...");
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator);
                    return deferred.promise;
                })
                .done(done, done);
        });

        it("localPackage.install.revert.norevert", function(done) {

            mockResponse = { updateInfo: getMockResponse(true) };

            /* create an update */
            setupUpdateProject(UpdateNotifyApplicationReady, "Update 1 (good update)")
                .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED, su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* run the app again to ensure it was not reverted */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                    console.log("Restarting application...");
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator);
                    return deferred.promise;
                })
                .done(done, done);
        });
    });

    describe("#localPackage.installOnNextResume", function() {

        afterEach(() => {
            cleanupScenario();
        });

        beforeEach(() => {
            return setupScenario(ScenarioInstallOnResumeWithRevert);
        });

        it("localPackage.installOnNextResume.dorevert", function(done) {

            mockResponse = { updateInfo: getMockResponse(true) };

            setupUpdateProject(UpdateDeviceReady, "Update 1")
                .then<string>(() => { return projectManager.createUpdateArchive(updatesDirectory, targetPlatform); })
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* resume the application */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                    console.log("Resuming project...");
                    projectManager.resumeApplication(0, targetPlatform, TestNamespace, testRunDirectory, targetEmulator);
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* restart to revert it */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.UPDATE_FAILED_PREVIOUSLY], deferred);
                    console.log("Restarting project...");
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator);
                    return deferred.promise;
                })
                .done(done, done);
        });

        it("localPackage.installOnNextResume.norevert", function(done) {

            mockResponse = { updateInfo: getMockResponse(true) };

            /* create an update */
            setupUpdateProject(UpdateNotifyApplicationReady, "Update 1 (good update)")
                .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* resume the application */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                    console.log("Resuming project...");
                    projectManager.resumeApplication(0, targetPlatform, TestNamespace, testRunDirectory, targetEmulator).done();
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* restart to make sure it did not revert */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                    console.log("Restarting project...");
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator).done();
                    return deferred.promise;
                })
                .done(done, done);
        });
    });

    describe("#localPackage.installOnNextRestart", function() {

        afterEach(() => {
            cleanupScenario();
        });

        beforeEach(() => {
            return setupScenario(ScenarioInstallOnRestartWithRevert);
        });

        it("localPackage.installOnNextRestart.dorevert", function(done) {

            mockResponse = { updateInfo: getMockResponse(true) };

            setupUpdateProject(UpdateDeviceReady, "Update 1")
                .then<string>(() => { return projectManager.createUpdateArchive(updatesDirectory, targetPlatform); })
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* restart the application */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                    console.log("Restarting project. Update hash: " + mockResponse.updateInfo.packageHash);
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator);
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* restart the application */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.UPDATE_FAILED_PREVIOUSLY], deferred);
                    console.log("Restarting project. Update hash: " + mockResponse.updateInfo.packageHash);
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator);
                    return deferred.promise;
                })
                .done(done, done);
        });

        it("localPackage.installOnNextRestart.norevert", function(done) {

            mockResponse = { updateInfo: getMockResponse(true) };

            /* create an update */
            setupUpdateProject(UpdateNotifyApplicationReady, "Update 1 (good update)")
                .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* "resume" the application - run it again */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                    console.log("Running project...");
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator).done();
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* run again to make sure it did not revert */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                    console.log("Running project...");
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator).done();
                    return deferred.promise;
                })
                .done(done, done);
        });

        it("localPackage.installOnNextRestart.revertToPrevious", function(done) {

            mockResponse = { updateInfo: getMockResponse(true) };

            /* create an update */
            setupUpdateProject(UpdateNotifyApplicationReadyConditional, "Update 1 (good update)")
                .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* run good update, set up another (bad) update */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS, su.TestMessage.UPDATE_INSTALLED], deferred);
                    console.log("Running project...");
                    mockResponse = { updateInfo: getMockResponse(true) };
                    setupUpdateProject(UpdateDeviceReady, "Update 2 (bad update)")
                        .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                        .then(() => { return projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator); }).done();
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* run the bad update without calling notifyApplicationReady */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                    console.log("Running project...");
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator).done();
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* run the good update and don't call notifyApplicationReady - it should not revert */
                    var deferred = Q.defer<void>();
                    testMessageResponse = su.TestMessageResponse.SKIP_NOTIFY_APPLICATION_READY;
                    testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.SKIPPED_NOTIFY_APPLICATION_READY], deferred);
                    console.log("Running project...");
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator).done();
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* run the application again */
                    var deferred = Q.defer<void>();
                    testMessageResponse = undefined;
                    testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS, su.TestMessage.UPDATE_FAILED_PREVIOUSLY], deferred);
                    console.log("Running project...");
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator).done();
                    return deferred.promise;
                })
                .done(done, done);
        });
    });

    describe("#codePush.restartApplication", function() {

        afterEach(() => {
            cleanupScenario();
        });

        beforeEach(() => {
            return setupScenario(ScenarioRestart);
        });

        it("codePush.restartApplication.checkPackages", function(done) {

            mockResponse = { updateInfo: getMockResponse(true) };

            setupUpdateProject(UpdateNotifyApplicationReady, "Update 1")
                .then<string>(() => { return projectManager.createUpdateArchive(updatesDirectory, targetPlatform); })
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = verifyMessages([
                        new su.AppMessage(su.TestMessage.PENDING_PACKAGE, [null]),
                        new su.AppMessage(su.TestMessage.CURRENT_PACKAGE, [null]),
                        new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                        new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                        new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_INSTALLING_UPDATE]),
                        new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UPDATE_INSTALLED]),
                        new su.AppMessage(su.TestMessage.PENDING_PACKAGE, [mockResponse.updateInfo.packageHash]),
                        new su.AppMessage(su.TestMessage.CURRENT_PACKAGE, [null]),
                        su.TestMessage.RESTART_SUCCEEDED,
                        su.TestMessage.DEVICE_READY_AFTER_UPDATE,
                        su.TestMessage.NOTIFY_APP_READY_SUCCESS
                    ], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* restart the application */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([
                        su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS
                    ], deferred);
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator);
                    return deferred.promise;
                })
                .done(done, done);
        });
    });

    describe("#window.codePush.sync", function() {
        
        /* We test the functionality with sync twice--first, with sync only called one,
         * then, with sync called again while the first sync is still running 
        
        /* Tests where sync is called just once */
        describe("window.codePush.sync.1x", function() {

            afterEach(() => {
                cleanupScenario();
            });

            beforeEach(() => {
                return setupScenario(ScenarioSync1x);
            });

            it("window.codePush.sync.noupdate", function(done) {
                var noUpdateResponse = createDefaultResponse();
                noUpdateResponse.isAvailable = false;
                noUpdateResponse.appVersion = "0.0.1";
                mockResponse = { updateInfo: noUpdateResponse };

                Q({})
                    .then<void>(p => {
                        var deferred = Q.defer<void>();
                        testMessageCallback = verifyMessages([
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UP_TO_DATE])],
                            deferred);
                        console.log("Running project...");
                        projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator).done();
                        return deferred.promise;
                    })
                    .done(done, done);
            });

            it("window.codePush.sync.checkerror", function(done) {
                mockResponse = "invalid {{ json";

                Q({})
                    .then<void>(p => {
                        var deferred = Q.defer<void>();
                        testMessageCallback = verifyMessages([
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_ERROR])],
                            deferred);
                        console.log("Running project...");
                        projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator).done();
                        return deferred.promise;
                    })
                    .done(done, done);
            });

            it("window.codePush.sync.downloaderror", function(done) {
                var invalidUrlResponse = createMockResponse();
                invalidUrlResponse.downloadURL = path.join(templatePath, "invalid_path.zip");
                mockResponse = { updateInfo: invalidUrlResponse };

                Q({})
                    .then<void>(p => {
                        var deferred = Q.defer<void>();
                        testMessageCallback = verifyMessages([
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_ERROR])],
                            deferred);
                        console.log("Running project...");
                        projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator).done();
                        return deferred.promise;
                    })
                    .done(done, done);
            });

            it("window.codePush.sync.dorevert", function(done) {

                mockResponse = { updateInfo: getMockResponse(true) };
            
                /* create an update */
                setupUpdateProject(UpdateDeviceReady, "Update 1 (bad update)")
                    .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                    .then<void>((updatePath: string) => {
                        var deferred = Q.defer<void>();
                        mockUpdatePackagePath = updatePath;
                        testMessageCallback = verifyMessages([
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_INSTALLING_UPDATE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UPDATE_INSTALLED]),
                            su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                        console.log("Running project...");
                        projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator).done();
                        return deferred.promise;
                    })
                    .then<void>(() => {
                        var deferred = Q.defer<void>();
                        testMessageCallback = verifyMessages([
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UP_TO_DATE])], deferred);
                        projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator).done();
                        return deferred.promise;
                    })
                    .done(done, done);
            });

            it("window.codePush.sync.update", function(done) {
                mockResponse = { updateInfo: getMockResponse(false) };

                /* create an update */
                setupUpdateProject(UpdateSync, "Update 1 (good update)")
                    .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                    .then<void>((updatePath: string) => {
                        var deferred = Q.defer<void>();
                        mockUpdatePackagePath = updatePath;
                        testMessageCallback = verifyMessages([
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_INSTALLING_UPDATE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UPDATE_INSTALLED]),
                            su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                        console.log("Running project...");
                        projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator).done();
                        return deferred.promise;
                    })
                    .then<void>(() => {
                        var deferred = Q.defer<void>();
                        var noUpdateResponse = createDefaultResponse();
                        noUpdateResponse.isAvailable = false;
                        noUpdateResponse.appVersion = "0.0.1";
                        mockResponse = { updateInfo: noUpdateResponse };
                        testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                        projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator).done();
                        return deferred.promise;
                    })
                    .done(done, done);
            });
        });
        
        /* Tests where sync is called again before the first sync finishes */
        describe("window.codePush.sync.2x", function() {

            afterEach(() => {
                cleanupScenario();
            });

            beforeEach(() => {
                return setupScenario(ScenarioSync2x);
            });

            it("window.codePush.sync.2x.noupdate", function(done) {
                var noUpdateResponse = createDefaultResponse();
                noUpdateResponse.isAvailable = false;
                noUpdateResponse.appVersion = "0.0.1";
                mockResponse = { updateInfo: noUpdateResponse };

                Q({})
                    .then<void>(p => {
                        var deferred = Q.defer<void>();
                        testMessageCallback = verifyMessages([
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_IN_PROGRESS]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UP_TO_DATE])],
                            deferred);
                        console.log("Running project...");
                        projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator).done();
                        return deferred.promise;
                    })
                    .done(done, done);
            });

            it("window.codePush.sync.2x.checkerror", function(done) {
                mockResponse = "invalid {{ json";

                Q({})
                    .then<void>(p => {
                        var deferred = Q.defer<void>();
                        testMessageCallback = verifyMessages([
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_IN_PROGRESS]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_ERROR])],
                            deferred);
                        console.log("Running project...");
                        projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator).done();
                        return deferred.promise;
                    })
                    .done(done, done);
            });

            it("window.codePush.sync.2x.downloaderror", function(done) {
                var invalidUrlResponse = createMockResponse();
                invalidUrlResponse.downloadURL = path.join(templatePath, "invalid_path.zip");
                mockResponse = { updateInfo: invalidUrlResponse };

                Q({})
                    .then<void>(p => {
                        var deferred = Q.defer<void>();
                        testMessageCallback = verifyMessages([
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_IN_PROGRESS]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_ERROR])],
                            deferred);
                        console.log("Running project...");
                        projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator).done();
                        return deferred.promise;
                    })
                    .done(done, done);
            });

            it("window.codePush.sync.2x.dorevert", function(done) {

                mockResponse = { updateInfo: getMockResponse(true) };
            
                /* create an update */
                setupUpdateProject(UpdateDeviceReady, "Update 1 (bad update)")
                    .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                    .then<void>((updatePath: string) => {
                        var deferred = Q.defer<void>();
                        mockUpdatePackagePath = updatePath;
                        testMessageCallback = verifyMessages([
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_IN_PROGRESS]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_INSTALLING_UPDATE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UPDATE_INSTALLED]),
                            su.TestMessage.DEVICE_READY_AFTER_UPDATE],
                            deferred);
                        console.log("Running project...");
                        projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator).done();
                        return deferred.promise;
                    })
                    .then<void>(() => {
                        var deferred = Q.defer<void>();
                        testMessageCallback = verifyMessages([
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_IN_PROGRESS]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UP_TO_DATE])],
                            deferred);
                        projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator).done();
                        return deferred.promise;
                    })
                    .done(done, done);
            });

            it("window.codePush.sync.2x.update", function(done) {
                mockResponse = { updateInfo: getMockResponse(false) };

                /* create an update */
                setupUpdateProject(UpdateSync2x, "Update 1 (good update)")
                    .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                    .then<void>((updatePath: string) => {
                        var deferred = Q.defer<void>();
                        mockUpdatePackagePath = updatePath;
                        testMessageCallback = verifyMessages([
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_IN_PROGRESS]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_INSTALLING_UPDATE]),
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UPDATE_INSTALLED])],
                            deferred);
                        console.log("Running project...");
                        projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator).done();
                        return deferred.promise;
                    })
                    .then<void>(() => {
                        var deferred = Q.defer<void>();
                        var noUpdateResponse = createDefaultResponse();
                        noUpdateResponse.isAvailable = false;
                        noUpdateResponse.appVersion = "0.0.1";
                        mockResponse = { updateInfo: noUpdateResponse };
                        testMessageCallback = verifyMessages([
                            su.TestMessage.DEVICE_READY_AFTER_UPDATE,
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_IN_PROGRESS])],
                            deferred);
                        projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator).done();
                        return deferred.promise;
                    })
                    .done(done, done);
            });
        });
        
        describe("minimum background duration tests", function() {

            afterEach(() => {
                cleanupScenario();
            });
            
            it("defaults to 0", function(done) {
                mockResponse = { updateInfo: getMockResponse(false) };

                /* create an update */
                setupScenario(ScenarioSyncResume).then<void>(() => {
                        return setupUpdateProject(UpdateSync, "Update 1 (good update)");
                    })
                    .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                    .then<void>((updatePath: string) => {
                        var deferred = Q.defer<void>();
                        mockUpdatePackagePath = updatePath;
                        testMessageCallback = verifyMessages([
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UPDATE_INSTALLED])], deferred);
                        console.log("Running project...");
                        projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator).done();
                        return deferred.promise;
                    })
                    .then<void>(() => {
                        var deferred = Q.defer<void>();
                        var noUpdateResponse = createDefaultResponse();
                        noUpdateResponse.isAvailable = false;
                        noUpdateResponse.appVersion = "0.0.1";
                        mockResponse = { updateInfo: noUpdateResponse };
                        testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                        console.log("Resuming project...");
                        projectManager.resumeApplication(0, targetPlatform, TestNamespace, testRunDirectory, targetEmulator).done();
                        return deferred.promise;
                    })
                    .done(done, done);
            });
            
            it("min background duration 30s", function(done) {
                mockResponse = { updateInfo: getMockResponse(false) };

                /* create an update */
                setupScenario(ScenarioSyncResume30).then<void>(() => {
                        return setupUpdateProject(UpdateSync, "Update 1 (good update)");
                    })
                    .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                    .then<void>((updatePath: string) => {
                        var deferred = Q.defer<void>();
                        mockUpdatePackagePath = updatePath;
                        testMessageCallback = verifyMessages([
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UPDATE_INSTALLED])], deferred);
                        console.log("Running project...");
                        projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator).done();
                        return deferred.promise;
                    })
                    .then<void>(() => {
                        var noUpdateResponse = createDefaultResponse();
                        noUpdateResponse.isAvailable = false;
                        noUpdateResponse.appVersion = "0.0.1";
                        mockResponse = { updateInfo: noUpdateResponse };
                        console.log("Resuming project...");
                        return projectManager.resumeApplication(10 * 1000, targetPlatform, TestNamespace, testRunDirectory, targetEmulator);
                    })
                    .then<void>(() => {
                        var deferred = Q.defer<void>();
                        testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                        projectManager.resumeApplication(40 * 1000, targetPlatform, TestNamespace, testRunDirectory, targetEmulator).done();
                        return deferred.promise;
                    })
                    .done(done, done);
            });
            
            it("has no effect on restart", function(done) {
                mockResponse = { updateInfo: getMockResponse(false) };

                /* create an update */
                setupScenario(ScenarioSyncRestart30).then<void>(() => {
                        return setupUpdateProject(UpdateSync, "Update 1 (good update)");
                    })
                    .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                    .then<void>((updatePath: string) => {
                        var deferred = Q.defer<void>();
                        mockUpdatePackagePath = updatePath;
                        testMessageCallback = verifyMessages([
                            new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UPDATE_INSTALLED])], deferred);
                        console.log("Running project...");
                        projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator).done();
                        return deferred.promise;
                    })
                    .then<void>(() => {
                        var deferred = Q.defer<void>();
                        var noUpdateResponse = createDefaultResponse();
                        noUpdateResponse.isAvailable = false;
                        noUpdateResponse.appVersion = "0.0.1";
                        mockResponse = { updateInfo: noUpdateResponse };
                        testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                        console.log("Restarting project...");
                        projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator).done();
                        return deferred.promise;
                    })
                    .done(done, done);
            });
            
        });
    });
});

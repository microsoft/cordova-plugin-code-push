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

const TestAppName = "TestCodePush";
const TestNamespace = "com.microsoft.codepush.test";
const AcquisitionSDKPluginName = "code-push";

const ScenarioCheckForUpdatePath = "js/scenarioCheckForUpdate.js";
const ScenarioCheckForUpdateCustomKey = "js/scenarioCheckForUpdateCustomKey.js";
const ScenarioDownloadUpdate = "js/scenarioDownloadUpdate.js";
const ScenarioInstall = "js/scenarioInstall.js";
const ScenarioInstallOnResumeWithRevert = "js/scenarioInstallOnResumeWithRevert.js";
const ScenarioInstallOnRestartWithRevert = "js/scenarioInstallOnRestartWithRevert.js";
const ScenarioInstallWithRevert = "js/scenarioInstallWithRevert.js";
const ScenarioSync = "js/scenarioSync.js";

const UpdateDeviceReady = "js/updateDeviceReady.js";
const UpdateNotifyApplicationReady = "js/updateNotifyApplicationReady.js";
const UpdateSync = "js/updateSync.js";
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

    app.get("/updateCheck", function(req: any, res: any) {
        updateCheckCallback && updateCheckCallback(req);
        res.send(mockResponse);
        console.log("Update check called from the app.");
        console.log("Request: " + req);
    });

    app.get("/download", function(req: any, res: any) {
        res.download(mockUpdatePackagePath);
    });

    app.post("/reportTestMessage", function(req: any, res: any) {
        console.log("Application reported a test message.");
        console.log("Body: " + JSON.stringify(req.body));

        if (!testMessageResponse) {
            console.log("Seding OK");
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
        .then<void>(() => { return projectManager.buildPlatform(testRunDirectory, targetPlatform); });
}

function createDefaultResponse(): su.CheckForUpdateResponseMock {
    var defaultReponse = new su.CheckForUpdateResponseMock();

    defaultReponse.downloadURL = "";
    defaultReponse.description = "";
    defaultReponse.isAvailable = false;
    defaultReponse.isMandatory = false;
    defaultReponse.appVersion = "";
    defaultReponse.packageHash = "";
    defaultReponse.label = "";
    defaultReponse.packageSize = 0;
    defaultReponse.updateAppVersion = false;

    return defaultReponse;
}

function createMockResponse(): su.CheckForUpdateResponseMock {
    var updateReponse = new su.CheckForUpdateResponseMock();
    updateReponse.isAvailable = true;
    updateReponse.appVersion = "1.0.0";
    updateReponse.downloadURL = "mock.url/download";
    updateReponse.isMandatory = true;
    updateReponse.label = "mock-update";
    updateReponse.packageHash = "12345-67890";
    updateReponse.packageSize = 12345;
    updateReponse.updateAppVersion = false;

    return updateReponse;
}

var getMockResponse = (randomHash: boolean): su.CheckForUpdateResponseMock => {
    var updateReponse = createMockResponse();
    updateReponse.downloadURL = serverUrl + "/download";
    /* for some tests we need unique hashes to avoid conflicts - the application is not uninstalled between tests
       and we store the failed hashes in preferences */
    if (randomHash) {
        updateReponse.packageHash = "randomHash-" + Math.floor(Math.random() * 10000);
    }
    return updateReponse;
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
            var noUpdateReponse = createDefaultResponse();
            noUpdateReponse.isAvailable = false;
            noUpdateReponse.appVersion = "0.0.1";

            mockResponse = { updateInfo: noUpdateReponse };

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
            var updateAppVersionReponse = createDefaultResponse();
            updateAppVersionReponse.updateAppVersion = true;
            updateAppVersionReponse.appVersion = "2.0.0";

            mockResponse = { updateInfo: updateAppVersionReponse };

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
            var updateReponse = createMockResponse();
            mockResponse = { updateInfo: updateReponse };

            testMessageCallback = (requestBody: any) => {
                try {
                    assert.equal(su.TestMessage.CHECK_UPDATE_AVAILABLE, requestBody.message);
                    assert.notEqual(null, requestBody.args[0]);
                    var remotePackage: IRemotePackage = requestBody.args[0];
                    assert.equal(remotePackage.downloadUrl, updateReponse.downloadURL);
                    assert.equal(remotePackage.isMandatory, updateReponse.isMandatory);
                    assert.equal(remotePackage.label, updateReponse.label);
                    assert.equal(remotePackage.packageHash, updateReponse.packageHash);
                    assert.equal(remotePackage.packageSize, updateReponse.packageSize);
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
            var updateReponse = createMockResponse();
            mockResponse = { updateInfo: updateReponse };

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
            var updateReponse = createMockResponse();
            updateReponse.downloadURL = serverUrl + "/download";
            return updateReponse;
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
            var updateReponse = createMockResponse();
            updateReponse.downloadURL = serverUrl + "/download";
            return updateReponse;
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
                    /* "resume" the application - run it again */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                    console.log("Running project...");
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator);
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* "resume" the application - run it again */
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([su.TestMessage.UPDATE_FAILED_PREVIOUSLY], deferred);
                    console.log("Running project...");
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
                .done(done, done);
        });
    });

    describe("#window.codePush.sync", function() {

        afterEach(() => {
            cleanupScenario();
        });

        beforeEach(() => {
            return setupScenario(ScenarioSync);
        });

        it("window.codePush.sync.noupdate", function(done) {
            var noUpdateReponse = createDefaultResponse();
            noUpdateReponse.isAvailable = false;
            noUpdateReponse.appVersion = "0.0.1";
            mockResponse = { updateInfo: noUpdateReponse };

            Q({})
                .then<void>(p => {
                    var deferred = Q.defer<void>();
                    testMessageCallback = verifyMessages([new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
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
                    testMessageCallback = verifyMessages([new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
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
                    testMessageCallback = verifyMessages([new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
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
                    var noUpdateReponse = createDefaultResponse();
                    noUpdateReponse.isAvailable = false;
                    noUpdateReponse.appVersion = "0.0.1";
                    mockResponse = { updateInfo: noUpdateReponse };
                    testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                    projectManager.restartApplication(targetPlatform, TestNamespace, testRunDirectory, targetEmulator).done();
                    return deferred.promise;
                })
                .done(done, done);
        });
    });
});

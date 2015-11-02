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

const AndroidKey = "mock-android-deployment-key";
const IOSKey = "mock-ios-deployment-key";
const TestAppName = "TestCodePush";
const TestNamespace = "com.microsoft.codepush.test";
const AcquisitionSDKPluginName = "code-push";

const ScenarioCheckForUpdatePath = "js/scenarioCheckForUpdate.js";
const ScenarioDownloadUpdate = "js/scenarioDownloadUpdate.js";
const ScenarioApply = "js/scenarioApply.js";
const ScenarioApplyWithRevert = "js/scenarioApplyWithRevert.js";
const ScenarioSync = "js/scenarioSync.js";
const ScenarioSyncWithRevert = "js/scenarioSyncWithRevert.js";

const UpdateDeviceReady = "js/updateDeviceReady.js";
const UpdateNotifyApplicationReady = "js/updateNotifyApplicationReady.js";
const UpdateSync = "js/updateSync.js";

var app: any;
var server: any;
var mockResponse: any;
var testMessageCallback: (requestBody: any) => void;
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
        res.send(mockResponse);
        console.log("Update check called from the app.");
    });

    app.get("/download", function(req: any, res: any) {
        res.download(mockUpdatePackagePath);
    });

    app.post("/reportTestMessage", function(req: any, res: any) {
        console.log("Application reported a test message.");
        console.log("Body: " + JSON.stringify(req.body));
        res.sendStatus(200);
        testMessageCallback(req.body);
    });

    server = app.listen(3000);

    return projectManager.setupTemplate(testRunDirectory, templatePath, serverUrl, AndroidKey, IOSKey, TestAppName, TestNamespace, scenarioPath)
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
        updateReponse.packageHash = "randomHash-" + Math.floor(Math.random() * 1000);
    }
    return updateReponse;
};

function setupUpdateProject(scenarioPath: string, version: string): Q.Promise<void> {
    console.log("Creating an update at location: " + updatesDirectory);
    return projectManager.setupTemplate(updatesDirectory, templatePath, serverUrl, AndroidKey, IOSKey, TestAppName, TestNamespace, scenarioPath, version)
        .then<void>(() => { return projectManager.addPlatform(updatesDirectory, targetPlatform); })
        .then<void>(() => { return projectManager.addPlugin(testRunDirectory, AcquisitionSDKPluginName); })
        .then<void>(() => { return projectManager.addPlugin(updatesDirectory, thisPluginPath); })
        .then<void>(() => { return projectManager.buildPlatform(updatesDirectory, targetPlatform); });
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
    });

    describe("#window.codePush.checkForUpdate", function() {

        before(() => {
            return setupScenario(ScenarioCheckForUpdatePath);
        });

        after(() => {
            cleanupScenario();
        });

        it("should handle no update scenario", function(done) {
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

        it("should return no update in updateAppVersion scenario", function(done) {
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

        it("should handle update scenario", function(done) {
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
                    done();
                } catch (e) {
                    done(e);
                }
            };

            console.log("Running project...");
            projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
        });

        it("should handle error during check for update scenario", function(done) {
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

        it("should successfully download new updates", function(done) {
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

        it("should handle errors during download", function(done) {
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

    describe("#localPackage.apply", function() {

        after(() => {
            cleanupScenario();
        });

        before(() => {
            return setupScenario(ScenarioApply);
        });

        var getMockResponse = (): su.CheckForUpdateResponseMock => {
            var updateReponse = createMockResponse();
            updateReponse.downloadURL = serverUrl + "/download";
            return updateReponse;
        };

        it("should handle unzip errors", function(done) {

            mockResponse = { updateInfo: getMockResponse() };

            /* pass an invalid zip file, here, config.xml */
            mockUpdatePackagePath = path.join(templatePath, "config.xml");

            testMessageCallback = (requestBody: any) => {
                try {
                    assert.equal(su.TestMessage.APPLY_ERROR, requestBody.message);
                    done();
                } catch (e) {
                    done(e);
                }
            };

            console.log("Running project...");
            projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
        });

        it("should handle apply", function(done) {

            mockResponse = { updateInfo: getMockResponse() };

            /* create an update */
            setupUpdateProject(UpdateDeviceReady, "Update 1")
                .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = verifyMessages([su.TestMessage.APPLY_SUCCESS, su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .done(done, done);
        });
    });

    describe("#localPackage.apply (with revert)", function() {

        after(() => {
            cleanupScenario();
        });

        before(() => {
            return setupScenario(ScenarioApplyWithRevert);
        });

        it("should handle revert", function(done) {

            mockResponse = { updateInfo: getMockResponse(false) };

            /* create an update */
            setupUpdateProject(UpdateDeviceReady, "Update 1 (bad update)")
                .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = verifyMessages([su.TestMessage.APPLY_SUCCESS, su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.UPDATE_FAILED_PREVIOUSLY], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .then<void>(() => {
                    /* create a second failed update */
                    console.log("Creating a second failed update.");
                    var deferred = Q.defer<void>();
                    mockResponse = { updateInfo: getMockResponse(true) };
                    testMessageCallback = verifyMessages([su.TestMessage.APPLY_SUCCESS, su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.UPDATE_FAILED_PREVIOUSLY], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .done(done, done);
        });

        it("should not revert on success", function(done) {

            mockResponse = { updateInfo: getMockResponse(true) };

            /* create an update */
            setupUpdateProject(UpdateNotifyApplicationReady, "Update 1 (good update)")
                .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = verifyMessages([su.TestMessage.APPLY_SUCCESS, su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS, su.TestMessage.APPLICATION_NOT_REVERTED], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .done(done, done);
        });
    });

    describe("#window.codePush.sync (no revert)", function() {

        after(() => {
            cleanupScenario();
        });

        before(() => {
            return setupScenario(ScenarioSync);
        });

        it("sync should handle no update scenario", function(done) {
            var noUpdateReponse = createDefaultResponse();
            noUpdateReponse.isAvailable = false;
            noUpdateReponse.appVersion = "0.0.1";

            mockResponse = { updateInfo: noUpdateReponse };

            testMessageCallback = (requestBody: any) => {
                try {
                    assert(su.areEqual(requestBody, new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UP_TO_DATE])));
                    done();
                } catch (e) {
                    done(e);
                }
            };

            console.log("Running project...");
            projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
        });

        it("should handle error during check for update scenario", function(done) {
            mockResponse = "invalid {{ json";

            testMessageCallback = (requestBody: any) => {
                try {
                    assert(su.areEqual(requestBody, new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_ERROR])));
                    done();
                } catch (e) {
                    done(e);
                }
            };

            console.log("Running project...");
            projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
        });

        it("should handle errors during download", function(done) {
            var invalidUrlResponse = createMockResponse();
            invalidUrlResponse.downloadURL = path.join(templatePath, "invalid_path.zip");
            mockResponse = { updateInfo: invalidUrlResponse };

            testMessageCallback = (requestBody: any) => {
                try {
                    assert(su.areEqual(requestBody, new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_ERROR])));
                    done();
                } catch (e) {
                    done(e);
                }
            };

            console.log("Running project...");
            projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
        });

        it("sync should apply when update available", function(done) {
            mockResponse = { updateInfo: getMockResponse(false) };

            /* create an update */
            setupUpdateProject(UpdateDeviceReady, "Update 1 (good update)")
                .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = verifyMessages([new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_APPLY_SUCCESS]), su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .done(done, done);
        });
    });

    describe("#window.codePush.sync (with revert)", function() {

        after(() => {
            cleanupScenario();
        });

        before(() => {
            return setupScenario(ScenarioSyncWithRevert);
        });

        it("sync should handle revert", function(done) {

            mockResponse = { updateInfo: getMockResponse(false) };
        
            /* create an update */
            setupUpdateProject(UpdateDeviceReady, "Update 1 (bad update)")
                .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = verifyMessages([new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_APPLY_SUCCESS]), su.TestMessage.DEVICE_READY_AFTER_UPDATE, new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UP_TO_DATE])], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .done(done, done);
        });

        it("sync should not revert on success", function(done) {

            mockResponse = { updateInfo: getMockResponse(true) };
        
            /* create an update */
            setupUpdateProject(UpdateSync, "Update 1 (good update)")
                .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = verifyMessages([new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_APPLY_SUCCESS]), su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.APPLICATION_NOT_REVERTED], deferred);
                    console.log("Running project...");
                    projectManager.runPlatform(testRunDirectory, targetPlatform, true, targetEmulator);
                    return deferred.promise;
                })
                .done(done, done);
        });
    });
});

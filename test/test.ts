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
var templateManager = tm.ProjectManager;
var testUtil = tu.TestUtil;

var templatePath = path.join(__dirname, "../../test/template");
var acquisitionPluginPath = path.join(__dirname, "../../test/cordova-plugin-code-push-acquisition");
var thisPluginPath = path.join(__dirname, "../..");
var testRunDirectory = path.join(os.tmpdir(), "cordova-plugin-code-push", "test-run");
var updatesDirectory = path.join(os.tmpdir(), "cordova-plugin-code-push", "updates");
var serverUrl = testUtil.readMockServerName();
var targetPlatform: platform.IPlatform = platform.PlatformResolver.resolvePlatform(testUtil.readTargetPlatform());

const AndroidKey = "mock-android-deployment-key";
const IOSKey = "mock-ios-deployment-key";
const TestAppName = "TestCodePush";
const TestNamespace = "com.microsoft.codepush.test";

const ScenarioCheckForUpdatePath = "js/scenarioCheckForUpdate.js";
const ScenarioDownloadUpdate = "js/scenarioDownloadUpdate.js";
const ScenarioApply = "js/scenarioApply.js";
const UpdateDeviceReady = "js/updateDeviceReady.js";


var app: any;
var server: any;
var mockResponse: any;
var testMessageCallback: (requestBody: any) => void;
var mockUpdatePackagePath: string;
var messageIndex = 0;

function cleanupScenario() {
    if (server) {
        server.close();
        server = undefined;
    }
    messageIndex = 0;
}

function setupScenario(scenarioPath: string): Q.Promise<void> {
    console.log("\nScenario: " + scenarioPath);
    console.log("Mock server url: " + serverUrl);
    console.log("Target platform: " + targetPlatform && targetPlatform.getCordovaName());

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

    return templateManager.setupTemplate(testRunDirectory, templatePath, serverUrl, AndroidKey, IOSKey, TestAppName, TestNamespace, scenarioPath)
        .then<void>(templateManager.addPlatform.bind(undefined, testRunDirectory, targetPlatform))
        .then<void>(templateManager.addPlugin.bind(undefined, testRunDirectory, acquisitionPluginPath))
        .then<void>(templateManager.addPlugin.bind(undefined, testRunDirectory, thisPluginPath))
        .then<void>(templateManager.buildPlatform.bind(undefined, testRunDirectory, targetPlatform));
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
            var noUpdateReponse = new su.CheckForUpdateResponseMock();
            noUpdateReponse.isAvailable = false;

            mockResponse = { updateInfo: noUpdateReponse };

            testMessageCallback = (requestBody: any) => {
                assert.equal(su.TestMessage.CHECK_UP_TO_DATE, requestBody.message);
                done();
            };

            console.log("Running project...");
            templateManager.runPlatform(testRunDirectory, targetPlatform, true);
        });

        it("should handle update scenario", function(done) {
            var updateReponse = createMockResponse();
            mockResponse = { updateInfo: updateReponse };

            testMessageCallback = (requestBody: any) => {
                assert.equal(su.TestMessage.CHECK_UPDATE_AVAILABLE, requestBody.message);
                assert.notEqual(null, requestBody.args[0]);
                var remotePackage: IRemotePackage = requestBody.args[0];
                assert.equal(remotePackage.downloadUrl, updateReponse.downloadURL);
                assert.equal(remotePackage.isMandatory, updateReponse.isMandatory);
                assert.equal(remotePackage.label, updateReponse.label);
                assert.equal(remotePackage.packageHash, updateReponse.packageHash);
                assert.equal(remotePackage.packageSize, updateReponse.packageSize);
                done();
            };

            console.log("Running project...");
            templateManager.runPlatform(testRunDirectory, targetPlatform, true);
        });

        it("should handle error during check for update scenario", function(done) {
            mockResponse = "invalid {{ json";

            testMessageCallback = (requestBody: any) => {
                assert.equal(su.TestMessage.CHECK_ERROR, requestBody.message);
                done();
            };

            console.log("Running project...");
            templateManager.runPlatform(testRunDirectory, targetPlatform, true);
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
                assert.equal(su.TestMessage.DOWNLOAD_SUCCEEDED, requestBody.message);
                done();
            };

            console.log("Running project...");
            templateManager.runPlatform(testRunDirectory, targetPlatform, true);
        });

        it("should handle errors during download", function(done) {
            mockResponse = { updateInfo: getMockResponse() };

            /* pass an invalid path */
            mockUpdatePackagePath = path.join(templatePath, "invalid_path.zip");

            testMessageCallback = (requestBody: any) => {
                assert.equal(su.TestMessage.DOWNLOAD_ERROR, requestBody.message);
                done();
            };

            console.log("Running project...");
            templateManager.runPlatform(testRunDirectory, targetPlatform, true);
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

        var setupUpdateProject = (scenarioPath: string, version: string): Q.Promise<void> => {
            console.log("Creating an update at location: " + updatesDirectory);
            return templateManager.setupTemplate(updatesDirectory, templatePath, serverUrl, AndroidKey, IOSKey, TestAppName, TestNamespace, scenarioPath, version)
                .then<void>(templateManager.addPlatform.bind(undefined, updatesDirectory, targetPlatform))
                .then<void>(templateManager.addPlugin.bind(undefined, updatesDirectory, acquisitionPluginPath))
                .then<void>(templateManager.addPlugin.bind(undefined, updatesDirectory, thisPluginPath))
                .then<void>(templateManager.buildPlatform.bind(undefined, updatesDirectory, targetPlatform));
        };

        it("should handle unzip errors", function(done) {
            mockResponse = { updateInfo: getMockResponse() };

            /* pass an invalid zip file, here, config.xml */
            mockUpdatePackagePath = path.join(templatePath, "config.xml");

            testMessageCallback = (requestBody: any) => {
                assert.equal(su.TestMessage.APPLY_ERROR, requestBody.message);
                done();
            };

            console.log("Running project...");
            templateManager.runPlatform(testRunDirectory, targetPlatform, true);
        });

        it("should handle apply", function(done) {
            mockResponse = { updateInfo: getMockResponse() };

            /* create an update */
            setupUpdateProject(UpdateDeviceReady, "Update 1")
                .then<string>(templateManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                .then<void>((updatePath: string) => {
                    var deferred = Q.defer<void>();
                    mockUpdatePackagePath = updatePath;
                    testMessageCallback = (requestBody: any) => {
                        try {
                            console.log("Message index: " + messageIndex);
                            if (messageIndex === 0) {
                                assert.equal(su.TestMessage.APPLY_SUCCESS, requestBody.message);
                            } else if (messageIndex === 1) {
                                assert.equal(su.TestMessage.DEVICE_READY_AFTER_UPDATE, requestBody.message);
                                deferred.resolve(undefined);
                            }
                            messageIndex++;
                        } catch (e) {
                            deferred.reject(e);
                        }
                    };

                    console.log("Running project...");
                    templateManager.runPlatform(testRunDirectory, targetPlatform, true);
                    return deferred.promise;
                })
                .done(done, done);
        });
    });
});

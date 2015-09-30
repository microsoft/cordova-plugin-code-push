/// <reference path="../typings/mocha.d.ts" />
/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/assert.d.ts" />

"use strict";

import tm = require("./projectManager");
import tu = require("./testUtil");
import su = require("./serverUtil");
import path = require("path");
import os = require("os");
import assert = require("assert");

var express = require("express");
var bodyparser = require("body-parser");
var templateManager = tm.ProjectManager;
var testUtil = tu.TestUtil;

var templatePath = path.join(__dirname, "../../test/template");
var acquisitionPluginPath = path.join(__dirname, "../../test/cordova-plugin-code-push-acquisition");
var thisPluginPath = path.join(__dirname, "../..");
var testRunDirectory = path.join(os.tmpdir(), "cordova-plugin-code-push", "test-run");
var serverUrl = testUtil.readMockServerName();
var targetPlatform = testUtil.readTargetPlatform();

const AndroidKey = "mock-android-deployment-key";
const IOSKey = "mock-ios-deployment-key";
const TestAppName = "TestCodePush";
const TestNamespace = "com.microsoft.codepush.test";

describe("window.codePush", function() {

    this.timeout(100 * 60 * 1000);

    before(() => {
        console.log("\nMock server url: " + serverUrl);
        console.log("Target platform: " + targetPlatform);
        return templateManager.setupTemplate(testRunDirectory, templatePath, serverUrl, AndroidKey, IOSKey, TestAppName, TestNamespace)
            .then<void>(templateManager.addPlatform.bind(undefined, testRunDirectory, targetPlatform))
            .then<void>(templateManager.addPlugin.bind(undefined, testRunDirectory, acquisitionPluginPath))
            .then<void>(templateManager.addPlugin.bind(undefined, testRunDirectory, thisPluginPath))
            .then<void>(templateManager.buildPlatform.bind(undefined, testRunDirectory, targetPlatform));
    });

    describe("#queryUpdate", function() {

        this.timeout(100 * 60 * 1000);

        var app = express();
        app.use(bodyparser.json());
        app.use(bodyparser.urlencoded({ extended: true }));

        var mockResponse: any;
        var testMessageCallback: (requestBody: any) => void;

        /* clean up */
        afterEach(() => {
            mockResponse = undefined;
            testMessageCallback = undefined;
        });

        app.get("/updateCheck", function(req: any, res: any) {
            res.send(mockResponse);
            console.log("Update check called from the app.");
        });

        app.post("/reportTestMessage", function(req: any, res: any) {
            console.log("Application reported a test message.");
            console.log("Body: " + JSON.stringify(req.body));
            res.sendStatus(200);
            testMessageCallback(req.body);
        });

        app.listen(3000);

        it("should handle no update scenario", function(done) {
            setTimeout(done, 100 * 60 * 1000);

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
            setTimeout(done, 100 * 60 * 1000);

            var updateReponse = new su.CheckForUpdateResponseMock();
            updateReponse.isAvailable = true;
            updateReponse.appVersion = "1.0.0";
            updateReponse.downloadURL = "http://mock.url";
            updateReponse.isMandatory = true;
            updateReponse.label = "update1";
            updateReponse.packageHash = "12345-67890";
            updateReponse.packageSize = 12345;
            updateReponse.updateAppVersion = false;

            mockResponse = { updateInfo: updateReponse };

            testMessageCallback = (requestBody: any) => {
                assert.equal(su.TestMessage.CHECK_UPDATE_AVAILABLE, requestBody.message);
                done();
            };

            console.log("Running project...");
            templateManager.runPlatform(testRunDirectory, targetPlatform, true);
        });

        it("should handle error during check for update scenario", function(done) {
            setTimeout(done, 100 * 60 * 1000);

            mockResponse = "invalid {{ json";

            testMessageCallback = (requestBody: any) => {
                assert.equal(su.TestMessage.CHECK_ERROR, requestBody.message);
                done();
            };

            console.log("Running project...");
            templateManager.runPlatform(testRunDirectory, targetPlatform, true);
        });
    });
});

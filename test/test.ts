/// <reference types="mocha" />
/// <reference types="node" />
/// <reference types="power-assert" />
/// <reference path="../typings/codePush.d.ts" />

"use strict";

// IMPORTS //

import tm = require("./projectManager");
import tu = require("./testUtil");
import su = require("./serverUtil");
import platform = require("./platform");
import path = require("path");
import assert = require("assert");
import Q = require("q");

// GLOBALS //

var express = require("express");
var bodyparser = require("body-parser");
var projectManager = tm.ProjectManager;
var testUtil = tu.TestUtil;

var templatePath = testUtil.templatePath;
var thisPluginPath = testUtil.readPluginPath();
var testRunDirectory = testUtil.readTestRunDirectory();
var updatesDirectory = testUtil.readTestUpdatesDirectory();
var onlyRunCoreTests = testUtil.readCoreTestsOnly();
var targetPlatforms: platform.IPlatform[] = platform.PlatformResolver.resolvePlatforms(testUtil.readTargetPlatforms());
var shouldUseWkWebView = testUtil.readShouldUseWkWebView();
var shouldSetup: boolean = testUtil.readShouldSetup();
var restartEmulators: boolean = testUtil.readRestartEmulators();

const TestAppName = "CodePushTest";
const TestNamespace = "com.microsoft.codepush.test";
const AcquisitionSDKPluginName = "code-push";
const WkWebViewEnginePluginName = "cordova-plugin-wkwebview-engine";

const ScenarioCheckForUpdatePath = "js/scenarioCheckForUpdate.js";
const ScenarioCheckForUpdateCustomKey = "js/scenarioCheckForUpdateCustomKey.js";
const ScenarioDownloadUpdate = "js/scenarioDownloadUpdate.js";
const ScenarioInstall = "js/scenarioInstall.js";
const ScenarioInstallOnResumeWithRevert = "js/scenarioInstallOnResumeWithRevert.js";
const ScenarioInstallOnRestartWithRevert = "js/scenarioInstallOnRestartWithRevert.js";
const ScenarioInstallOnRestart2xWithRevert = "js/scenarioInstallOnRestart2xWithRevert.js";
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

var mockResponse: any;
var testMessageResponse: any;
var testMessageCallback: (requestBody: any) => void;
var updateCheckCallback: (requestBody: any) => void;
var mockUpdatePackagePath: string;

// FUNCTIONS //

function cleanupTest(): void {
    console.log("Cleaning up!");
    mockResponse = undefined;
    testMessageCallback = undefined;
    updateCheckCallback = undefined;
    testMessageResponse = undefined;
}

function setupTests(): void {
    it("sets up tests correctly", (done: any) => {
        var promises: Q.Promise<string>[] = [];

        targetPlatforms.forEach(platform => {
            promises.push(platform.getEmulatorManager().bootEmulator(restartEmulators));
        });

        console.log("Building test project.");
        promises.push(createTestProject(testRunDirectory));

        console.log("Building update project.");
        promises.push(createTestProject(updatesDirectory));

        Q.all<string>(promises).then(() => { done(); }, (error) => { done(error); });
    });
}

function createTestProject(directory: string): Q.Promise<string> {
    return projectManager.setupProject(directory, templatePath, TestAppName, TestNamespace)
    .then(() => {
        var promises: Q.Promise<string>[] = [];
        
        targetPlatforms.forEach(platform => {
            promises.push(projectManager.addPlatform(directory, platform));
        });

        return Q.all<string>(promises);
    })
    .then(() => {
        return projectManager.addPlugin(directory, thisPluginPath);
    });
}

function createDefaultResponse(): su.CheckForUpdateResponseMock {
    var defaultResponse = new su.CheckForUpdateResponseMock();

    defaultResponse.download_url = "";
    defaultResponse.description = "";
    defaultResponse.is_available = false;
    defaultResponse.is_mandatory = false;
    defaultResponse.is_disabled = false;
    defaultResponse.target_binary_range = "";
    defaultResponse.package_hash = "";
    defaultResponse.label = "";
    defaultResponse.package_size = 0;
    defaultResponse.should_run_binary_version = false;
    defaultResponse.update_app_version = false;

    return defaultResponse;
}

function createMockResponse(mandatory: boolean = false): su.CheckForUpdateResponseMock {
    var updateResponse = new su.CheckForUpdateResponseMock();
    updateResponse.is_available = true;
    updateResponse.target_binary_range = "1.0.0";
    updateResponse.download_url = "mock.url/download";
    updateResponse.is_disabled = false;
    updateResponse.is_mandatory = mandatory;
    updateResponse.label = "mock-update";
    updateResponse.package_hash = "12345-67890";
    updateResponse.package_size = 12345;
    updateResponse.should_run_binary_version = false;
    updateResponse.update_app_version = false;

    return updateResponse;
}

function verifyMessages(expectedMessages: (string | su.AppMessage)[], deferred: Q.Deferred<void>): (requestBody: any) => void {
    var messageIndex = 0;
    return (requestBody: su.AppMessage) => {
        try {
            console.log("Message index: " + messageIndex);
            if (typeof expectedMessages[messageIndex] === "string") {
                assert.equal(requestBody.message, expectedMessages[messageIndex]);
            }
            else {
                assert(su.areEqual(requestBody, <su.AppMessage>expectedMessages[messageIndex]));
            }
            /* end of message array */
            if (++messageIndex === expectedMessages.length) {
                deferred.resolve(undefined);
            }
        } catch (e) {
            deferred.reject(e);
        }
    };
}

function runTests(targetPlatform: platform.IPlatform, useWkWebView: boolean): void {
    var server: any;

    function setupServer() {
        console.log("Setting up server at " + targetPlatform.getServerUrl());

        var app = express();
        app.use(bodyparser.json());
        app.use(bodyparser.urlencoded({ extended: true }));

        app.use(function(req: any, res: any, next: any) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "*");
            res.setHeader("Access-Control-Allow-Headers", "origin, content-type, accept, X-CodePush-SDK-Version, X-CodePush-Plugin-Version, X-CodePush-Plugin-Name");
            next();
        });

        app.get("/v0.1/public/codepush/update_check", function(req: any, res: any) {
            updateCheckCallback && updateCheckCallback(req);
            res.send(mockResponse);
            console.log("Update check called from the app.");
            console.log("Request: " + JSON.stringify(req.query));
            console.log("Response: " + JSON.stringify(mockResponse));
        });

        app.get("/v0.1/public/codepush/report_status/download", function(req: any, res: any) {
            console.log("Application downloading the package.");

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

        var serverPortRegEx = /:([0-9]+)/;
        server = app.listen(+targetPlatform.getServerUrl().match(serverPortRegEx)[1]);
    }

    function cleanupServer(): void {
        if (server) {
            server.close();
            server = undefined;
        }
    }

    function prepareTest(): Q.Promise<string> {
        return projectManager.prepareEmulatorForTest(TestNamespace, targetPlatform);
    }

    function getMockResponse(mandatory: boolean = false, randomHash: boolean = true): su.CheckForUpdateResponseMock {
        var updateResponse = createMockResponse(mandatory);
        updateResponse.download_url = targetPlatform.getServerUrl() + "/v0.1/public/codepush/report_status/download";
        // we need unique hashes to avoid conflicts - the application is not uninstalled between tests
        // and we store the failed hashes in preferences
        if (randomHash) {
            updateResponse.package_hash = "randomHash-" + Math.floor(Math.random() * 10000);
        }
        return updateResponse;
    }

    function setupScenario(scenarioPath: string): Q.Promise<string> {
        console.log("\nScenario: " + scenarioPath);
        return projectManager.setupScenario(testRunDirectory, TestNamespace, templatePath, scenarioPath, targetPlatform);
    }

    function setupUpdateScenario(updateScenarioPath: string, version: string): Q.Promise<string> {
        console.log("Creating an update at location: " + updatesDirectory);
        return projectManager.setupScenario(updatesDirectory, TestNamespace, templatePath, updateScenarioPath, targetPlatform, false, version);
    }

    describe("window.codePush", function() {
        before(() => {
            setupServer();
            return projectManager.uninstallApplication(TestNamespace, targetPlatform)
            .then(() => { 
                return useWkWebView ? projectManager.addPlugin(testRunDirectory, WkWebViewEnginePluginName).then(() => { return projectManager.addPlugin(updatesDirectory, WkWebViewEnginePluginName); }) : null;
            });
        });

        after(() => {
            cleanupServer();
            return useWkWebView ? projectManager.removePlugin(testRunDirectory, WkWebViewEnginePluginName).then(() => { return projectManager.removePlugin(updatesDirectory, WkWebViewEnginePluginName); }) : null;
        });

        describe("#window.codePush.checkForUpdate", function() {

            afterEach(() => {
                cleanupTest();
            });

            before(() => {
                return setupScenario(ScenarioCheckForUpdatePath);
            });

            beforeEach(() => {
                return prepareTest();
            });

            if (!onlyRunCoreTests) {
                it("window.codePush.checkForUpdate.noUpdate", function(done: any) {
                    var noUpdateResponse = createDefaultResponse();
                    noUpdateResponse.is_available = false;
                    noUpdateResponse.target_binary_range = "0.0.1";

                    mockResponse = { update_info: noUpdateResponse };

                    testMessageCallback = (requestBody: any) => {
                        try {
                            assert.equal(su.TestMessage.CHECK_UP_TO_DATE, requestBody.message);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    };

                    projectManager.runPlatform(testRunDirectory, targetPlatform);
                });

                it("window.codePush.checkForUpdate.sendsBinaryHash", function(done: any) {
                    var noUpdateResponse = createDefaultResponse();
                    noUpdateResponse.is_available = false;
                    noUpdateResponse.target_binary_range = "0.0.1";

                    updateCheckCallback = (request: any) => {
                        try {
                            assert(request.query.package_hash);
                        } catch (e) {
                            done(e);
                        }
                    };

                    mockResponse = { update_info: noUpdateResponse };

                    testMessageCallback = (requestBody: any) => {
                        try {
                            assert.equal(su.TestMessage.CHECK_UP_TO_DATE, requestBody.message);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    };

                    projectManager.runPlatform(testRunDirectory, targetPlatform);
                });

                it("window.codePush.checkForUpdate.noUpdate.updateAppVersion", function(done: any) {
                    var updateAppVersionResponse = createDefaultResponse();
                    updateAppVersionResponse.update_app_version = true;
                    updateAppVersionResponse.target_binary_range = "2.0.0";

                    mockResponse = { update_info: updateAppVersionResponse };

                    testMessageCallback = (requestBody: any) => {
                        try {
                            assert.equal(su.TestMessage.CHECK_UP_TO_DATE, requestBody.message);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    };

                    projectManager.runPlatform(testRunDirectory, targetPlatform);
                });
            }

            // CORE TEST
            it("window.codePush.checkForUpdate.update", function(done: any) {
                var updateResponse = createMockResponse();
                mockResponse = { update_info: updateResponse };

                testMessageCallback = (requestBody: any) => {
                    try {
                        assert.equal(su.TestMessage.CHECK_UPDATE_AVAILABLE, requestBody.message);
                        assert.notEqual(null, requestBody.args[0]);
                        var remotePackage: IRemotePackage = requestBody.args[0];
                        assert.equal(remotePackage.downloadUrl, updateResponse.download_url);
                        assert.equal(remotePackage.isMandatory, updateResponse.is_mandatory);
                        assert.equal(remotePackage.label, updateResponse.label);
                        assert.equal(remotePackage.packageHash, updateResponse.package_hash);
                        assert.equal(remotePackage.packageSize, updateResponse.package_size);
                        assert.equal(remotePackage.deploymentKey, targetPlatform.getDefaultDeploymentKey());
                        done();
                    } catch (e) {
                        done(e);
                    }
                };

                updateCheckCallback = (request: any) => {
                    try {
                        assert.notEqual(null, request);
                        assert.equal(request.query.deployment_key, targetPlatform.getDefaultDeploymentKey());
                    } catch (e) {
                        done(e);
                    }
                };

                projectManager.runPlatform(testRunDirectory, targetPlatform);
            });

            if (!onlyRunCoreTests) {
                it("window.codePush.checkForUpdate.error", function(done: any) {
                    mockResponse = "invalid {{ json";

                    testMessageCallback = (requestBody: any) => {
                        try {
                            assert.equal(su.TestMessage.CHECK_ERROR, requestBody.message);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    };

                    projectManager.runPlatform(testRunDirectory, targetPlatform);
                });
            }
        });

        if (!onlyRunCoreTests) {
            describe("#window.codePush.checkForUpdate.customKey", function() {

                afterEach(() => {
                    cleanupTest();
                });

                before(() => {
                    return setupScenario(ScenarioCheckForUpdateCustomKey);
                });

                beforeEach(() => {
                    return prepareTest();
                });

                it("window.codePush.checkForUpdate.customKey.update", function(done: any) {
                    var updateResponse = createMockResponse();
                    mockResponse = { update_info: updateResponse };

                    updateCheckCallback = (request: any) => {
                        try {
                            assert.notEqual(null, request);
                            assert.equal(request.query.deployment_key, "CUSTOM-DEPLOYMENT-KEY");
                            done();
                        } catch (e) {
                            done(e);
                        }
                    };

                    projectManager.runPlatform(testRunDirectory, targetPlatform);
                });
            });

            describe("#remotePackage.download", function() {

                afterEach(() => {
                    cleanupTest();
                });

                before(() => {
                    return setupScenario(ScenarioDownloadUpdate);
                });

                beforeEach(() => {
                    return prepareTest();
                });

                var getMockResponse = (): su.CheckForUpdateResponseMock => {
                    var updateResponse = createMockResponse();
                    updateResponse.download_url = targetPlatform.getServerUrl() + "/v0.1/public/codepush/report_status/download";
                    return updateResponse;
                };

                it("remotePackage.download.success", function(done: any) {
                    mockResponse = { update_info: getMockResponse() };

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

                    projectManager.runPlatform(testRunDirectory, targetPlatform);
                });

                it("remotePackage.download.error", function(done: any) {
                    mockResponse = { update_info: getMockResponse() };

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

                    projectManager.runPlatform(testRunDirectory, targetPlatform);
                });
            });

            describe("#localPackage.install", function() {

                afterEach(() => {
                    cleanupTest();
                });

                before(() => {
                    return setupScenario(ScenarioInstall);
                });

                beforeEach(() => {
                    return prepareTest();
                });

                var getMockResponse = (): su.CheckForUpdateResponseMock => {
                    var updateResponse = createMockResponse();
                    updateResponse.download_url = targetPlatform.getServerUrl() + "/v0.1/public/codepush/report_status/download";
                    return updateResponse;
                };

                it("localPackage.install.unzip.error", function(done: any) {

                    mockResponse = { update_info: getMockResponse() };

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

                    projectManager.runPlatform(testRunDirectory, targetPlatform);
                });

                it("localPackage.install.handlesDiff.againstBinary", function(done: any) {

                    mockResponse = { update_info: getMockResponse() };

                    /* create an update */
                    setupUpdateScenario(UpdateNotifyApplicationReady, "Diff Update 1")
                        .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform, /*isDiff*/ true))
                        .then<void>((updatePath: string) => {
                            var deferred = Q.defer<void>();
                            mockUpdatePackagePath = updatePath;
                            testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED, su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                            projectManager.runPlatform(testRunDirectory, targetPlatform);
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            /* run the app again to ensure it was not reverted */
                            var deferred = Q.defer<void>();
                            testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                            projectManager.restartApplication(TestNamespace, targetPlatform);
                            return deferred.promise;
                        })
                        .done(done, done);
                });

                it("localPackage.install.immediately", function(done: any) {

                    mockResponse = { update_info: getMockResponse() };

                    /* create an update */
                    setupScenario(ScenarioInstall).then<string>(() => {
                        return setupUpdateScenario(UpdateNotifyApplicationReadyConditional, "Update 1");
                        })
                        .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                        .then<void>((updatePath: string) => {
                            var deferred = Q.defer<void>();
                            mockUpdatePackagePath = updatePath;
                            testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED, su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                            projectManager.runPlatform(testRunDirectory, targetPlatform);
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            /* run the app again to ensure it was not reverted */
                            var deferred = Q.defer<void>();
                            testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                            projectManager.restartApplication(TestNamespace, targetPlatform);
                            return deferred.promise;
                        })
                        .done(done, done);
                });
            });

            describe("#localPackage.install.revert", function() {

                afterEach(() => {
                    cleanupTest();
                });

                before(() => {
                    return setupScenario(ScenarioInstallWithRevert);
                });

                beforeEach(() => {
                    return prepareTest();
                });

                it("localPackage.install.revert.dorevert", function(done: any) {

                    mockResponse = { update_info: getMockResponse() };

                    /* create an update */
                    setupUpdateScenario(UpdateDeviceReady, "Update 1 (bad update)")
                        .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                        .then<void>((updatePath: string) => {
                            var deferred = Q.defer<void>();
                            mockUpdatePackagePath = updatePath;
                            testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED, su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                            projectManager.runPlatform(testRunDirectory, targetPlatform);
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            /* run the app again to ensure it was reverted */
                            var deferred = Q.defer<void>();
                            testMessageCallback = verifyMessages([su.TestMessage.UPDATE_FAILED_PREVIOUSLY], deferred);
                            projectManager.restartApplication(TestNamespace, targetPlatform);
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            /* create a second failed update */
                            console.log("Creating a second failed update.");
                            var deferred = Q.defer<void>();
                            mockResponse = { update_info: getMockResponse() };
                            testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED, su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                            projectManager.restartApplication(TestNamespace, targetPlatform);
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            /* run the app again to ensure it was reverted */
                            var deferred = Q.defer<void>();
                            testMessageCallback = verifyMessages([su.TestMessage.UPDATE_FAILED_PREVIOUSLY], deferred);
                            projectManager.restartApplication(TestNamespace, targetPlatform);
                            return deferred.promise;
                        })
                        .done(done, done);
                });

                it("localPackage.install.revert.norevert", function(done: any) {

                    mockResponse = { update_info: getMockResponse() };

                    /* create an update */
                    setupUpdateScenario(UpdateNotifyApplicationReady, "Update 1 (good update)")
                        .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                        .then<void>((updatePath: string) => {
                            var deferred = Q.defer<void>();
                            mockUpdatePackagePath = updatePath;
                            testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED, su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                            projectManager.runPlatform(testRunDirectory, targetPlatform);
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            /* run the app again to ensure it was not reverted */
                            var deferred = Q.defer<void>();
                            testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                            projectManager.restartApplication(TestNamespace, targetPlatform);
                            return deferred.promise;
                        })
                        .done(done, done);
                });
            });
        }

        describe("#localPackage.installOnNextResume", function() {

            afterEach(() => {
                cleanupTest();
            });

            before(() => {
                return setupScenario(ScenarioInstallOnResumeWithRevert);
            });

            beforeEach(() => {
                return prepareTest();
            });

            // CORE TEST
            it("localPackage.installOnNextResume.dorevert", function(done: any) {

                mockResponse = { update_info: getMockResponse() };

                setupUpdateScenario(UpdateDeviceReady, "Update 1")
                    .then<string>(() => { return projectManager.createUpdateArchive(updatesDirectory, targetPlatform); })
                    .then<void>((updatePath: string) => {
                        var deferred = Q.defer<void>();
                        mockUpdatePackagePath = updatePath;
                        testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED], deferred);
                        projectManager.runPlatform(testRunDirectory, targetPlatform);
                        return deferred.promise;
                    })
                    .then<void>(() => {
                        /* resume the application */
                        var deferred = Q.defer<void>();
                        testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                        projectManager.resumeApplication(TestNamespace, targetPlatform);
                        return deferred.promise;
                    })
                    .then<void>(() => {
                        /* restart to revert it */
                        var deferred = Q.defer<void>();
                        testMessageCallback = verifyMessages([su.TestMessage.UPDATE_FAILED_PREVIOUSLY], deferred);
                        projectManager.restartApplication(TestNamespace, targetPlatform);
                        return deferred.promise;
                    })
                    .done(done, done);
            });

            if (!onlyRunCoreTests) {
                it("localPackage.installOnNextResume.norevert", function(done: any) {

                    mockResponse = { update_info: getMockResponse() };

                    /* create an update */
                    setupUpdateScenario(UpdateNotifyApplicationReady, "Update 1 (good update)")
                        .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                        .then<void>((updatePath: string) => {
                            var deferred = Q.defer<void>();
                            mockUpdatePackagePath = updatePath;
                            testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED], deferred);
                            projectManager.runPlatform(testRunDirectory, targetPlatform);
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            /* resume the application */
                            var deferred = Q.defer<void>();
                            testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                            projectManager.resumeApplication(TestNamespace, targetPlatform);
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            /* restart to make sure it did not revert */
                            var deferred = Q.defer<void>();
                            testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                            projectManager.restartApplication(TestNamespace, targetPlatform);
                            return deferred.promise;
                        })
                        .done(done, done);
                });
            }
        });

        describe("#localPackage.installOnNextRestart", function() {

            afterEach(() => {
                cleanupTest();
            });

            before(() => {
                return setupScenario(ScenarioInstallOnRestartWithRevert);
            });

            beforeEach(() => {
                return prepareTest();
            });

            if (!onlyRunCoreTests) {
                it("localPackage.installOnNextRestart.dorevert", function(done: any) {

                    mockResponse = { update_info: getMockResponse() };

                    setupUpdateScenario(UpdateDeviceReady, "Update 1")
                        .then<string>(() => { return projectManager.createUpdateArchive(updatesDirectory, targetPlatform); })
                        .then<void>((updatePath: string) => {
                            var deferred = Q.defer<void>();
                            mockUpdatePackagePath = updatePath;
                            testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED], deferred);
                            projectManager.runPlatform(testRunDirectory, targetPlatform);
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            /* restart the application */
                            var deferred = Q.defer<void>();
                            testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                            console.log("Update hash: " + mockResponse.update_info.packageHash);
                            projectManager.restartApplication(TestNamespace, targetPlatform);
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            /* restart the application */
                            var deferred = Q.defer<void>();
                            testMessageCallback = verifyMessages([su.TestMessage.UPDATE_FAILED_PREVIOUSLY], deferred);
                            console.log("Update hash: " + mockResponse.update_info.packageHash);
                            projectManager.restartApplication(TestNamespace, targetPlatform);
                            return deferred.promise;
                        })
                        .done(done, done);
                });
            }

            // CORE TEST
            it("localPackage.installOnNextRestart.norevert", function(done: any) {

                mockResponse = { update_info: getMockResponse() };

                /* create an update */
                setupUpdateScenario(UpdateNotifyApplicationReady, "Update 1 (good update)")
                    .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                    .then<void>((updatePath: string) => {
                        var deferred = Q.defer<void>();
                        mockUpdatePackagePath = updatePath;
                        testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED], deferred);
                        projectManager.runPlatform(testRunDirectory, targetPlatform);
                        return deferred.promise;
                    })
                    .then<void>(() => {
                        /* "resume" the application - run it again */
                        var deferred = Q.defer<void>();
                        testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                        projectManager.restartApplication(TestNamespace, targetPlatform);
                        return deferred.promise;
                    })
                    .then<void>(() => {
                        /* run again to make sure it did not revert */
                        var deferred = Q.defer<void>();
                        testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS], deferred);
                        projectManager.restartApplication(TestNamespace, targetPlatform);
                        return deferred.promise;
                    })
                    .done(done, done);
            });

            if (!onlyRunCoreTests) {
                it("localPackage.installOnNextRestart.revertToPrevious", function(done: any) {

                    mockResponse = { update_info: getMockResponse() };

                    /* create an update */
                    setupScenario(ScenarioInstallOnRestartWithRevert).then<string>(() => {
                        return setupUpdateScenario(UpdateNotifyApplicationReadyConditional, "Update 1 (good update)");
                        })
                        .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                        .then<void>((updatePath: string) => {
                            var deferred = Q.defer<void>();
                            mockUpdatePackagePath = updatePath;
                            testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED], deferred);
                            projectManager.runPlatform(testRunDirectory, targetPlatform);
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            /* run good update, set up another (bad) update */
                            var deferred = Q.defer<void>();
                            testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS, su.TestMessage.UPDATE_INSTALLED], deferred);
                            mockResponse = { update_info: getMockResponse() };
                            setupUpdateScenario(UpdateDeviceReady, "Update 2 (bad update)")
                                .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                                .then(() => { return projectManager.restartApplication(TestNamespace, targetPlatform); });
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            /* run the bad update without calling notifyApplicationReady */
                            var deferred = Q.defer<void>();
                            testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                            projectManager.restartApplication(TestNamespace, targetPlatform);
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            /* run the good update and don't call notifyApplicationReady - it should not revert */
                            var deferred = Q.defer<void>();
                            testMessageResponse = su.TestMessageResponse.SKIP_NOTIFY_APPLICATION_READY;
                            testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.SKIPPED_NOTIFY_APPLICATION_READY], deferred);
                            projectManager.restartApplication(TestNamespace, targetPlatform);
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            /* run the application again */
                            var deferred = Q.defer<void>();
                            testMessageResponse = undefined;
                            testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS, su.TestMessage.UPDATE_FAILED_PREVIOUSLY], deferred);
                            projectManager.restartApplication(TestNamespace, targetPlatform);
                            return deferred.promise;
                        })
                        .done(done, done);
                });
            }
        });

        if (!onlyRunCoreTests) {
            describe("#localPackage.installOnNextRestart2x", function() {

                afterEach(() => {
                    cleanupTest();
                });

                before(() => {
                    return setupScenario(ScenarioInstallOnRestart2xWithRevert);
                });

                beforeEach(() => {
                    return prepareTest();
                });

                it("localPackage.installOnNextRestart2x.revertToFirst", function(done: any) {
                    mockResponse = { update_info: getMockResponse() };
                    updateCheckCallback = () => {
                        // Update the packageHash so we can install the same update twice.
                        mockResponse.packageHash = "randomHash-" + Math.floor(Math.random() * 10000);
                    };

                    /* create an update */
                    setupUpdateScenario(UpdateDeviceReady, "Bad Update")
                        .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                        .then<void>((updatePath: string) => {
                            var deferred = Q.defer<void>();
                            mockUpdatePackagePath = updatePath;
                            testMessageCallback = verifyMessages([su.TestMessage.UPDATE_INSTALLED, su.TestMessage.UPDATE_INSTALLED], deferred);
                            projectManager.runPlatform(testRunDirectory, targetPlatform);
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            /* verify that the bad update is run, then restart it */
                            var deferred = Q.defer<void>();
                            testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                            projectManager.restartApplication(TestNamespace, targetPlatform);
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            /* verify the app rolls back to the binary, ignoring the first unconfirmed version */
                            var deferred = Q.defer<void>();
                            testMessageCallback = verifyMessages([su.TestMessage.UPDATE_FAILED_PREVIOUSLY], deferred);
                            projectManager.restartApplication(TestNamespace, targetPlatform);
                            return deferred.promise;
                        })
                        .done(done, done);
                });
            });
        }

        describe("#codePush.restartApplication", function() {

            afterEach(() => {
                cleanupTest();
            });

            before(() => {
                return setupScenario(ScenarioRestart);
            });

            beforeEach(() => {
                return prepareTest();
            });

            it("codePush.restartApplication.checkPackages", function(done: any) {

                mockResponse = { update_info: getMockResponse() };

                setupUpdateScenario(UpdateNotifyApplicationReady, "Update 1")
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
                            new su.AppMessage(su.TestMessage.PENDING_PACKAGE, [mockResponse.update_info.package_hash]),
                            new su.AppMessage(su.TestMessage.CURRENT_PACKAGE, [null]),
                            su.TestMessage.DEVICE_READY_AFTER_UPDATE,
                            su.TestMessage.NOTIFY_APP_READY_SUCCESS
                        ], deferred);
                        projectManager.runPlatform(testRunDirectory, targetPlatform);
                        return deferred.promise;
                    })
                    .then<void>(() => {
                        /* restart the application */
                        var deferred = Q.defer<void>();
                        testMessageCallback = verifyMessages([
                            su.TestMessage.DEVICE_READY_AFTER_UPDATE, su.TestMessage.NOTIFY_APP_READY_SUCCESS
                        ], deferred);
                        projectManager.restartApplication(TestNamespace, targetPlatform);
                        return deferred.promise;
                    })
                    .done(done, done);
            });
        });

        describe("#window.codePush.sync", function() {

            /* We test the functionality with sync twice--first, with sync only called one,
            * then, with sync called again while the first sync is still running

            /* Tests where sync is called just once */
            if (!onlyRunCoreTests) {
                describe("#window.codePush.sync 1x", function() {

                    afterEach(() => {
                        cleanupTest();
                    });

                    before(() => {
                        return setupScenario(ScenarioSync1x);
                    });

                    beforeEach(() => {
                        return prepareTest();
                    });

                    it("window.codePush.sync.noupdate", function(done: any) {
                        var noUpdateResponse = createDefaultResponse();
                        noUpdateResponse.is_available = false;
                        noUpdateResponse.target_binary_range = "0.0.1";
                        mockResponse = { update_info: noUpdateResponse };

                        Q({})
                            .then<void>(p => {
                                var deferred = Q.defer<void>();
                                testMessageCallback = verifyMessages([
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UP_TO_DATE])],
                                    deferred);
                                projectManager.runPlatform(testRunDirectory, targetPlatform).done();
                                return deferred.promise;
                            })
                            .done(done, done);
                    });

                    it("window.codePush.sync.checkerror", function(done: any) {
                        mockResponse = "invalid {{ json";

                        Q({})
                            .then<void>(p => {
                                var deferred = Q.defer<void>();
                                testMessageCallback = verifyMessages([
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_ERROR])],
                                    deferred);
                                projectManager.runPlatform(testRunDirectory, targetPlatform).done();
                                return deferred.promise;
                            })
                            .done(done, done);
                    });

                    it("window.codePush.sync.downloaderror", function(done: any) {
                        var invalidUrlResponse = createMockResponse();
                        invalidUrlResponse.download_url = path.join(templatePath, "invalid_path.zip");
                        mockResponse = { update_info: invalidUrlResponse };

                        Q({})
                            .then<void>(p => {
                                var deferred = Q.defer<void>();
                                testMessageCallback = verifyMessages([
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_ERROR])],
                                    deferred);
                                projectManager.runPlatform(testRunDirectory, targetPlatform).done();
                                return deferred.promise;
                            })
                            .done(done, done);
                    });

                    it("window.codePush.sync.dorevert", function(done: any) {

                        mockResponse = { update_info: getMockResponse() };

                        /* create an update */
                        setupUpdateScenario(UpdateDeviceReady, "Update 1 (bad update)")
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
                                projectManager.runPlatform(testRunDirectory, targetPlatform).done();
                                return deferred.promise;
                            })
                            .then<void>(() => {
                                var deferred = Q.defer<void>();
                                testMessageCallback = verifyMessages([
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UP_TO_DATE])], deferred);
                                projectManager.restartApplication(TestNamespace, targetPlatform).done();
                                return deferred.promise;
                            })
                            .done(done, done);
                    });

                    it("window.codePush.sync.update", function(done: any) {
                        mockResponse = { update_info: getMockResponse() };

                        /* create an update */
                        setupUpdateScenario(UpdateSync, "Update 1 (good update)")
                            .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                            .then<void>((updatePath: string) => {
                                var deferred = Q.defer<void>();
                                mockUpdatePackagePath = updatePath;
                                testMessageCallback = verifyMessages([
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_INSTALLING_UPDATE]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UPDATE_INSTALLED]),
                                    // the update is immediate so the update will install
                                    su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                                projectManager.runPlatform(testRunDirectory, targetPlatform).done();
                                return deferred.promise;
                            })
                            .then<void>(() => {
                                // restart the app and make sure it didn't roll out!
                                var deferred = Q.defer<void>();
                                var noUpdateResponse = createDefaultResponse();
                                noUpdateResponse.is_available = false;
                                noUpdateResponse.target_binary_range = "0.0.1";
                                mockResponse = { update_info: noUpdateResponse };
                                testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                                projectManager.restartApplication(TestNamespace, targetPlatform).done();
                                return deferred.promise;
                            })
                            .done(done, done);
                    });
                });
            }

            /* Tests where sync is called again before the first sync finishes */
            describe("#window.codePush.sync 2x", function() {

                afterEach(() => {
                    cleanupTest();
                });

                before(() => {
                    return setupScenario(ScenarioSync2x);
                });

                beforeEach(() => {
                    return prepareTest();
                });

                if (!onlyRunCoreTests) {
                    it("window.codePush.sync.2x.noupdate", function(done: any) {
                        var noUpdateResponse = createDefaultResponse();
                        noUpdateResponse.is_available = false;
                        noUpdateResponse.target_binary_range = "0.0.1";
                        mockResponse = { update_info: noUpdateResponse };

                        Q({})
                            .then<void>(p => {
                                var deferred = Q.defer<void>();
                                testMessageCallback = verifyMessages([
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_IN_PROGRESS]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UP_TO_DATE])],
                                    deferred);
                                projectManager.runPlatform(testRunDirectory, targetPlatform).done();
                                return deferred.promise;
                            })
                            .done(done, done);
                    });

                    it("window.codePush.sync.2x.checkerror", function(done: any) {
                        mockResponse = "invalid {{ json";

                        Q({})
                            .then<void>(p => {
                                var deferred = Q.defer<void>();
                                testMessageCallback = verifyMessages([
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_IN_PROGRESS]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_ERROR])],
                                    deferred);
                                projectManager.runPlatform(testRunDirectory, targetPlatform).done();
                                return deferred.promise;
                            })
                            .done(done, done);
                    });

                    it("window.codePush.sync.2x.downloaderror", function(done: any) {
                        var invalidUrlResponse = createMockResponse();
                        invalidUrlResponse.download_url = path.join(templatePath, "invalid_path.zip");
                        mockResponse = { update_info: invalidUrlResponse };

                        Q({})
                            .then<void>(p => {
                                var deferred = Q.defer<void>();
                                testMessageCallback = verifyMessages([
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_IN_PROGRESS]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_DOWNLOADING_PACKAGE]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_ERROR])],
                                    deferred);
                                projectManager.runPlatform(testRunDirectory, targetPlatform).done();
                                return deferred.promise;
                            })
                            .done(done, done);
                    });

                    it("window.codePush.sync.2x.dorevert", function(done: any) {

                        mockResponse = { update_info: getMockResponse() };

                        /* create an update */
                        setupUpdateScenario(UpdateDeviceReady, "Update 1 (bad update)")
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
                                projectManager.runPlatform(testRunDirectory, targetPlatform).done();
                                return deferred.promise;
                            })
                            .then<void>(() => {
                                var deferred = Q.defer<void>();
                                testMessageCallback = verifyMessages([
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_CHECKING_FOR_UPDATE]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_IN_PROGRESS]),
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UP_TO_DATE])],
                                    deferred);
                                projectManager.restartApplication(TestNamespace, targetPlatform).done();
                                return deferred.promise;
                            })
                            .done(done, done);
                    });
                }

                it("window.codePush.sync.2x.update", function(done: any) {
                    mockResponse = { update_info: getMockResponse() };

                    /* create an update */
                    setupUpdateScenario(UpdateSync2x, "Update 1 (good update)")
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
                                // the update is immediate so the update will install
                                su.TestMessage.DEVICE_READY_AFTER_UPDATE,
                                new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_IN_PROGRESS])],
                                deferred);
                            projectManager.runPlatform(testRunDirectory, targetPlatform).done();
                            return deferred.promise;
                        })
                        .then<void>(() => {
                            // restart the app and make sure it didn't roll out!
                            var deferred = Q.defer<void>();
                            var noUpdateResponse = createDefaultResponse();
                            noUpdateResponse.is_available = false;
                            noUpdateResponse.target_binary_range = "0.0.1";
                            mockResponse = { update_info: noUpdateResponse };
                            testMessageCallback = verifyMessages([
                                su.TestMessage.DEVICE_READY_AFTER_UPDATE,
                                new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_IN_PROGRESS])],
                                deferred);
                            projectManager.restartApplication(TestNamespace, targetPlatform).done();
                            return deferred.promise;
                        })
                        .done(done, done);
                });
            });

            if (!onlyRunCoreTests) {
                describe("#window.codePush.sync minimum background duration tests", function() {

                    afterEach(() => {
                        cleanupTest();
                    });

                    beforeEach(() => {
                        return prepareTest();
                    });

                    it("defaults to no minimum", function(done: any) {
                        mockResponse = { update_info: getMockResponse() };

                        setupScenario(ScenarioSyncResume).then<string>(() => {
                                return setupUpdateScenario(UpdateSync, "Update 1 (good update)");
                            })
                            .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                            .then<void>((updatePath: string) => {
                                var deferred = Q.defer<void>();
                                mockUpdatePackagePath = updatePath;
                                testMessageCallback = verifyMessages([
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UPDATE_INSTALLED])], deferred);
                                projectManager.runPlatform(testRunDirectory, targetPlatform).done();
                                return deferred.promise;
                            })
                            .then<void>(() => {
                                var deferred = Q.defer<void>();
                                var noUpdateResponse = createDefaultResponse();
                                noUpdateResponse.is_available = false;
                                noUpdateResponse.target_binary_range = "0.0.1";
                                mockResponse = { update_info: noUpdateResponse };
                                testMessageCallback = verifyMessages([
                                    su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                                projectManager.resumeApplication(TestNamespace, targetPlatform).done();
                                return deferred.promise;
                            })
                            .done(done, done);
                    });

                    it("min background duration 5s", function(done: any) {
                        mockResponse = { update_info: getMockResponse() };

                        setupScenario(ScenarioSyncResumeDelay).then<string>(() => {
                                return setupUpdateScenario(UpdateSync, "Update 1 (good update)");
                            })
                            .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                            .then<void>((updatePath: string) => {
                                var deferred = Q.defer<void>();
                                mockUpdatePackagePath = updatePath;
                                testMessageCallback = verifyMessages([
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UPDATE_INSTALLED])], deferred);
                                projectManager.runPlatform(testRunDirectory, targetPlatform).done();
                                return deferred.promise;
                            })
                            .then<string>(() => {
                                var noUpdateResponse = createDefaultResponse();
                                noUpdateResponse.is_available = false;
                                noUpdateResponse.target_binary_range = "0.0.1";
                                mockResponse = { update_info: noUpdateResponse };
                                return projectManager.resumeApplication(TestNamespace, targetPlatform, 3 * 1000);
                            })
                            .then<void>(() => {
                                var deferred = Q.defer<void>();
                                testMessageCallback = verifyMessages([
                                    su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                                projectManager.resumeApplication(TestNamespace, targetPlatform, 6 * 1000).done();
                                return deferred.promise;
                            })
                            .done(done, done);
                    });

                    it("has no effect on restart", function(done: any) {
                        mockResponse = { update_info: getMockResponse() };

                        setupScenario(ScenarioSyncRestartDelay).then<string>(() => {
                                return setupUpdateScenario(UpdateSync, "Update 1 (good update)");
                            })
                            .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                            .then<void>((updatePath: string) => {
                                var deferred = Q.defer<void>();
                                mockUpdatePackagePath = updatePath;
                                testMessageCallback = verifyMessages([
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UPDATE_INSTALLED])], deferred);
                                projectManager.runPlatform(testRunDirectory, targetPlatform).done();
                                return deferred.promise;
                            })
                            .then<void>(() => {
                                var deferred = Q.defer<void>();
                                var noUpdateResponse = createDefaultResponse();
                                noUpdateResponse.is_available = false;
                                noUpdateResponse.target_binary_range = "0.0.1";
                                mockResponse = { update_info: noUpdateResponse };
                                testMessageCallback = verifyMessages([su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                                projectManager.restartApplication(TestNamespace, targetPlatform).done();
                                return deferred.promise;
                            })
                            .done(done, done);
                    });

                });

                describe("#window.codePush.sync mandatory install mode tests", function() {

                    afterEach(() => {
                        cleanupTest();
                    });

                    beforeEach(() => {
                        return prepareTest();
                    });

                    it("defaults to IMMEDIATE", function(done: any) {
                        mockResponse = { update_info: getMockResponse(true) };

                        setupScenario(ScenarioSyncMandatoryDefault).then<string>(() => {
                                return setupUpdateScenario(UpdateDeviceReady, "Update 1 (good update)");
                            })
                            .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                            .then<void>((updatePath: string) => {
                                var deferred = Q.defer<void>();
                                mockUpdatePackagePath = updatePath;
                                testMessageCallback = verifyMessages([
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UPDATE_INSTALLED]),
                                    su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                                projectManager.runPlatform(testRunDirectory, targetPlatform).done();
                                return deferred.promise;
                            })
                            .done(done, done);
                    });

                    it("works correctly when update is mandatory and mandatory install mode is specified", function(done: any) {
                        mockResponse = { update_info: getMockResponse(true) };

                        setupScenario(ScenarioSyncMandatoryResume).then<string>(() => {
                                return setupUpdateScenario(UpdateDeviceReady, "Update 1 (good update)");
                            })
                            .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                            .then<void>((updatePath: string) => {
                                var deferred = Q.defer<void>();
                                mockUpdatePackagePath = updatePath;
                                testMessageCallback = verifyMessages([
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UPDATE_INSTALLED])], deferred);
                                projectManager.runPlatform(testRunDirectory, targetPlatform).done();
                                return deferred.promise;
                            })
                            .then<void>(() => {
                                var deferred = Q.defer<void>();
                                var noUpdateResponse = createDefaultResponse();
                                noUpdateResponse.is_available = false;
                                noUpdateResponse.target_binary_range = "0.0.1";
                                mockResponse = { update_info: noUpdateResponse };
                                testMessageCallback = verifyMessages([
                                    su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                                projectManager.resumeApplication(TestNamespace, targetPlatform, 5 * 1000).done();
                                return deferred.promise;
                            })
                            .done(done, done);
                    });

                    it("has no effect on updates that are not mandatory", function(done: any) {
                        mockResponse = { update_info: getMockResponse() };

                        setupScenario(ScenarioSyncMandatoryRestart).then<string>(() => {
                                return setupUpdateScenario(UpdateDeviceReady, "Update 1 (good update)");
                            })
                            .then<string>(projectManager.createUpdateArchive.bind(undefined, updatesDirectory, targetPlatform))
                            .then<void>((updatePath: string) => {
                                var deferred = Q.defer<void>();
                                mockUpdatePackagePath = updatePath;
                                testMessageCallback = verifyMessages([
                                    new su.AppMessage(su.TestMessage.SYNC_STATUS, [su.TestMessage.SYNC_UPDATE_INSTALLED]),
                                    su.TestMessage.DEVICE_READY_AFTER_UPDATE], deferred);
                                projectManager.runPlatform(testRunDirectory, targetPlatform).done();
                                return deferred.promise;
                            })
                            .done(done, done);
                    });

                });
            }
        });
    });
}

// CODE THAT EXECUTES THE TESTS //

describe("CodePush Cordova Plugin", function () {
    this.timeout(100 * 60 * 1000);

    if (shouldSetup) describe("Setting Up For Tests", () => setupTests());
    else {
        targetPlatforms.forEach(platform => {
            var prefix: string = (onlyRunCoreTests ? "Core Tests " : "Tests ") + thisPluginPath + " on ";
            if (platform.getCordovaName() === "ios") {
                // handle UIWebView
                if (shouldUseWkWebView === 0 || shouldUseWkWebView === 2) describe(prefix + platform.getCordovaName() + " with UIWebView", () => runTests(platform, false));
                // handle WkWebView
                if (shouldUseWkWebView === 1 || shouldUseWkWebView === 2) describe(prefix + platform.getCordovaName() + " with WkWebView", () => runTests(platform, true));
            } else {
                describe(prefix + platform.getCordovaName(), () => runTests(platform, false));
            }
        });
    }
});
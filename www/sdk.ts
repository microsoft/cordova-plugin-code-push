/// <reference path="../typings/codePush.d.ts" />
/// <reference types="cordova-plugin-device" />

"use strict";

import NativeAppInfo = require("./nativeAppInfo");
import HttpRequester = require("./httpRequester");

/**
 * Interacts with the CodePush Acquisition SDK.
 */
class Sdk {

    private static DefaultAcquisitionManager: AcquisitionManager;
    private static DefaultConfiguration: Configuration;

    /**
     * Reads the CodePush configuration and creates an AcquisitionManager instance using it.
     */
    public static getAcquisitionManager(callback: Callback<AcquisitionManager>, userDeploymentKey?: string, contentType?: string): void {
        var resolveManager = (): void => {
            if (userDeploymentKey !== Sdk.DefaultConfiguration.deploymentKey || contentType) {
                var customConfiguration: Configuration = {
                    deploymentKey: userDeploymentKey || Sdk.DefaultConfiguration.deploymentKey,
                    serverUrl: Sdk.DefaultConfiguration.serverUrl,
                    ignoreAppVersion: Sdk.DefaultConfiguration.ignoreAppVersion,
                    appVersion: Sdk.DefaultConfiguration.appVersion,
                    clientUniqueId: Sdk.DefaultConfiguration.clientUniqueId
                };
                var requester = new HttpRequester(contentType);
                var customAcquisitionManager: AcquisitionManager = new AcquisitionManager(requester, customConfiguration);
                callback(null, customAcquisitionManager);
            } else if (Sdk.DefaultConfiguration.deploymentKey) {
                callback(null, Sdk.DefaultAcquisitionManager);
            } else {
                callback(new Error("No deployment key provided, please provide a default one in your config.xml or specify one in the call to checkForUpdate() or sync()."), null);
            }
        };

        if (Sdk.DefaultAcquisitionManager) {
            resolveManager();
        } else {
            NativeAppInfo.getServerURL((serverError: Error, serverURL: string) => {
                NativeAppInfo.getDeploymentKey((depolymentKeyError: Error, deploymentKey: string) => {
                    NativeAppInfo.getApplicationVersion((appVersionError: Error, appVersion: string) => {
                        if (!appVersion) {
                            callback(new Error("Could not get the app version. Please check your config.xml file."), null);
                        } else if (!serverURL) {
                            callback(new Error("Could not get the CodePush configuration. Please check your config.xml file."), null);
                        } else {
                            Sdk.DefaultConfiguration = {
                                deploymentKey: deploymentKey,
                                serverUrl: serverURL,
                                ignoreAppVersion: false,
                                appVersion: appVersion,
                                clientUniqueId: device.uuid
                            };

                            if (deploymentKey) {
                                Sdk.DefaultAcquisitionManager = new AcquisitionManager(new HttpRequester(), Sdk.DefaultConfiguration);
                            }

                            resolveManager();
                        }
                    });
                });
            });
        }
    }

    /**
     * Reports the deployment status to the CodePush server.
     */
    public static reportStatusDeploy(pkg?: IPackage, status?: string, currentDeploymentKey?: string, previousLabelOrAppVersion?: string, previousDeploymentKey?: string, callback?: Callback<void>) {
        try {
            Sdk.getAcquisitionManager((error: Error, acquisitionManager: AcquisitionManager) => {
                if (error) {
                    callback && callback(error, null);
                }
                else {
                    acquisitionManager.reportStatusDeploy(pkg, status, previousLabelOrAppVersion, previousDeploymentKey, callback);
                }
            }, currentDeploymentKey, "application/json");
        } catch (e) {
            callback && callback(e, null);
        }
    }

    /**
     * Reports the download status to the CodePush server.
     */
    public static reportStatusDownload(pkg: IPackage, deploymentKey?: string, callback?: Callback<void>) {
        try {
            Sdk.getAcquisitionManager((error: Error, acquisitionManager: AcquisitionManager) => {
                if (error) {
                    callback && callback(error, null);
                }
                else {
                    acquisitionManager.reportStatusDownload(pkg, callback);
                }
            }, deploymentKey, "application/json");
        } catch (e) {
            callback && callback(new Error("An error occured while reporting the download status. " + e), null);
        }
    }
}

export = Sdk;

/// <reference path="../typings/codePush.d.ts" />
/// <reference path="../typings/fileTransfer.d.ts" />

"use strict";

import NativeAppInfo = require("./nativeAppInfo");
import HttpRequester = require("./httpRequester");

/**
 * Interacts with the CodePush Acquisition SDK.
 */
class Sdk {

    private static Instance: AcquisitionManager;
    
    /**
     * Reads the CodePush configuration and creates an AcquisitionManager instance using it.
     */
    public static getAcquisitionManager(callback: Callback<AcquisitionManager>): void {
        if (Sdk.Instance) {
            callback(null, Sdk.Instance);
        } else {
            NativeAppInfo.getServerURL((serverError: Error, serverURL: string) => {
                NativeAppInfo.getDeploymentKey((depolymentKeyError: Error, deploymentKey: string) => {
                    if (!serverURL || !deploymentKey) {
                        callback(new Error("Could not get the CodePush configuration. Please check your config.xml file."), null);
                    } else {
                        var configuration: Configuration = { deploymentKey: deploymentKey, serverUrl: serverURL, ignoreAppVersion: false };
                        Sdk.Instance = new AcquisitionManager(new HttpRequester(), configuration);
                        callback(null, Sdk.Instance);
                    }
                });
            });
        }
    }

    /**
     * Reports the update status to the CodePush server.
     */
    public static reportStatus(status: string, callback?: Callback<void>) {
        try {
            Sdk.getAcquisitionManager((error: Error, acquisitionManager: AcquisitionManager) => {
                if (error) {
                    callback && callback(error, null);
                }
                else {
                    acquisitionManager.reportStatus(status, null, callback);
                }
            });
        } catch (e) {
            callback && callback(new Error("An error ocurred while reporting the status. " + e), null);
        }
    }
}

export = Sdk;
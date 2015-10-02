/// <reference path="../typings/codePush.d.ts" />
/// <reference path="../typings/fileTransfer.d.ts" />

"use strict";

import NativeAppInfo = require("./nativeAppInfo");
import HttpRequester = require("./httpRequester");

/**
 * Interacts with the Code Push Acquisition SDK.
 */
class Sdk {
    /**
     * Reads the Code Push configuration and creates an AcquisitionManager instance using it.
     */
    public static createAcquisitionManager(callback: Callback<AcquisitionManager>): void {
        NativeAppInfo.getServerURL((serverError: Error, serverURL: string) => {
            NativeAppInfo.getDeploymentKey((depolymentKeyError: Error, deploymentKey: string) => {
                if (!serverURL || !deploymentKey) {
                    callback(new Error("Could not get the Code Push configuration. Please check your config.xml file."), null);
                } else {
                    var configuration: Configuration = { deploymentKey: deploymentKey, serverUrl: serverURL, ignoreAppVersion: false };
                    var acquisitionManager: AcquisitionManager = new AcquisitionManager(new HttpRequester(), configuration);
                    callback(null, acquisitionManager);
                }
            });
        });
    }

    /**
     * Reports the update status to the Code Push server.
     */
    public static reportStatus(status: string, callback?: Callback<void>) {
        try {
            Sdk.createAcquisitionManager((error: Error, acquisitionManager: AcquisitionManager) => {
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
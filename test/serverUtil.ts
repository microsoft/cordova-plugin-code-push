"use strict";

/**
 * Class used to mock the codePush.checkForUpdate() response from the server.
 */
export class CheckForUpdateResponseMock {
    downloadURL: string;
    isAvailable: boolean;
    packageSize: number;
    updateAppVersion: boolean;
    appVersion: string;
    description: string;
    label: string;
    packageHash: string;
    isMandatory: boolean;
}

/**
 * Contains all the messages sent from the application to the mock server during tests.
 */
export class TestMessage {
    public static CHECK_UP_TO_DATE = "CHECK_UP_TO_DATE";
    public static CHECK_UPDATE_AVAILABLE = "CHECK_UPDATE_AVAILABLE";
    public static CHECK_ERROR = "CHECK_ERROR";
    public static DOWNLOAD_SUCCEEDED = "DOWNLOAD_SUCCEEDED";
    public static DOWNLOAD_ERROR = "DOWNLOAD_ERROR";
    public static APPLY_SUCCESS = "APPLY_SUCCESS";
    public static APPLY_ERROR = "APPLY_ERROR";
    public static DEVICE_READY_AFTER_UPDATE = "DEVICE_READY_AFTER_UPDATE";
    public static UPDATE_FAILED_PREVIOUSLY = "UPDATE_FAILED_PREVIOUSLY";
    public static APPLICATION_NOT_REVERTED = "APPLICATION_NOT_REVERTED";
    public static NOTIFY_APP_READY_SUCCESS = "NOTIFY_APP_READY_SUCCESS";
    public static NOTIFY_APP_READY_FAILURE = "NOTIFY_APP_READY_FAILURE";
}
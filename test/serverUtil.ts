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
    public static SYNC_STATUS = "SYNC_STATUS";

    public static SYNC_UP_TO_DATE = 0;
    public static SYNC_APPLY_SUCCESS = 1;
    public static SYNC_UPDATE_IGNORED = 2;
    public static SYNC_ERROR = 3;
}

/**
 * Defines the messages sent from the application to the mock server during tests.
 */
export class AppMessage {
    message: string;
    args: any[];

    constructor(message: string, args: any[]) {
        this.message = message;
        this.args = args;
    }

    static fromString(message: string): AppMessage {
        return new AppMessage(message, undefined);
    }
}

/**
 * Checks if two messages are equal.
 */
export function areEqual(m1: AppMessage, m2: AppMessage): boolean {
    /* compare objects */
    if (m1 === m2) {
        return true;
    }

    /* compare messages */
    if (!m1 || !m2 || m1.message !== m2.message) {
        return false;
    }
    
    /* compare arguments */
    if (m1.args === m2.args) {
        return true;
    }

    if (!m1.args || !m2.args || m1.args.length !== m2.args.length) {
        return false;
    }

    for (var i = 0; i < m1.args.length; i++) {
        if (m1.args[i] !== m2.args[i]) {
            return false;
        }
    }

    return true;
}

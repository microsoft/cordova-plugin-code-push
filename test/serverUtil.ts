"use strict";

/**
 * Class used to mock the codePush.checkForUpdate() response from the server.
 */
export class CheckForUpdateResponseMock {
    download_url: string;
    is_available: boolean;
    is_disabled: boolean;
    package_size: number;
    update_app_version: boolean;
    target_binary_range: string;
    description: string;
    label: string;
    package_hash: string;
    should_run_binary_version: boolean;
    is_mandatory: boolean;
}

/**
 * The model class of the codePush.checkForUpdate() request to the server.
 */
export class UpdateCheckRequestMock {
    deploymentKey: string;
    target_binary_range: string;
    package_hash: string;
    isCompanion: boolean;
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
    public static UPDATE_INSTALLED = "UPDATE_INSTALLED";
    public static INSTALL_ERROR = "INSTALL_ERROR";
    public static DEVICE_READY_AFTER_UPDATE = "DEVICE_READY_AFTER_UPDATE";
    public static UPDATE_FAILED_PREVIOUSLY = "UPDATE_FAILED_PREVIOUSLY";
    public static NOTIFY_APP_READY_SUCCESS = "NOTIFY_APP_READY_SUCCESS";
    public static NOTIFY_APP_READY_FAILURE = "NOTIFY_APP_READY_FAILURE";
    public static SKIPPED_NOTIFY_APPLICATION_READY = "SKIPPED_NOTIFY_APPLICATION_READY";
    public static SYNC_STATUS = "SYNC_STATUS";
    public static RESTART_SUCCEEDED = "RESTART_SUCCEEDED";
    public static RESTART_FAILED = "RESTART_FAILED";
    public static PENDING_PACKAGE = "PENDING_PACKAGE";
    public static CURRENT_PACKAGE = "CURRENT_PACKAGE";

    public static SYNC_UP_TO_DATE = 0;
    public static SYNC_UPDATE_INSTALLED = 1;
    public static SYNC_UPDATE_IGNORED = 2;
    public static SYNC_ERROR = 3;
    public static SYNC_IN_PROGRESS = 4;
    public static SYNC_CHECKING_FOR_UPDATE = 5;
    public static SYNC_AWAITING_USER_ACTION = 6;
    public static SYNC_DOWNLOADING_PACKAGE = 7;
    public static SYNC_INSTALLING_UPDATE = 8;
}

/**
 * Contains all the messages sent from the mock server back to the application during tests.
 */
export class TestMessageResponse {
    public static SKIP_NOTIFY_APPLICATION_READY = "SKIP_NOTIFY_APPLICATION_READY";
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

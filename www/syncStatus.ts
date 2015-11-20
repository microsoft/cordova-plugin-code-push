/// <reference path="../typings/codePush.d.ts" />

"use strict";

/**
 * Defines the possible result and intermediate statuses of the window.codePush.sync operation.
 * The result statuses are final, mutually exclusive statuses of the sync operation. The operation will end with only one of the possible result statuses.
 * The intermediate statuses are not final, one or more of them can happen before sync ends, based on the options you use and user interaction.
 */
enum SyncStatus {
    /**
     * Result status - the application is up to date.
     */
    UP_TO_DATE,
    
    /**
     * Result status - an update is available, it has been downloaded, unzipped and copied to the deployment folder.
     * After the completion of the callback invoked with SyncStatus.UPDATE_INSTALLED, the application will be reloaded with the updated code and resources.
     */
    UPDATE_INSTALLED,
    
    /**
     * Result status - an optional update is available, but the user declined to install it. The update was not downloaded.
     */
    UPDATE_IGNORED,
    
    /**
     * Result status - an error happened during the sync operation. This might be an error while communicating with the server, downloading or unziping the update.
     * The console logs should contain more information about what happened. No update has been applied in this case.
     */
    ERROR,
    
    /**
     * Intermediate status - the plugin is about to check for updates.
     */
    CHECKING_FOR_UPDATE,
    
    /**
     * Intermediate status - a user dialog is about to be displayed. This status will be reported only if user interaction is enabled.
     */
    AWAITING_USER_ACTION,
    
    /**
     * Intermediate status - the update packages is about to be downloaded.
     */
    DOWNLOADING_PACKAGE,
    
    /**
     * Intermediate status - the update package is about to be installed.
     */
    INSTALLING_UPDATE
}

/**
 * Defines the available install modes for updates.
 */
enum InstallMode {
    /**
     * The update will be applied to the running application immediately. The application will be reloaded with the new content immediately.
     */
    IMMEDIATE,
    
    /**
     * The update is downloaded but not installed immediately. The new content will be available the next time the application is started.
     */
    ON_NEXT_RESTART,
    
    /**
     * The udpate is downloaded but not installed immediately. The new content will be available the next time the application is resumed or restarted, whichever event happends first.
     */
    ON_NEXT_RESUME
}

export = SyncStatus;
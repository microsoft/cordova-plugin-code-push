/// <reference path="../typings/codePush.d.ts" />

"use strict";

/**
 * Defines the possible result and intermediate statuses of the window.codePush.sync operation.
 * The result statuses are final, mutually exclusive statuses of the sync operation. The operation will end with only one of the possible result statuses.
 * The intermediate statuses are not final, one or more of them can happen before sync ends, based on the options you use and user interaction.
 * 
 * NOTE: Adding new statuses or changing old statuses requires an update to CodePush.sync(), which must know which callbacks are results and which are not!
 *       Also, don't forget to change the TestMessage module in ServerUtils!
 *       AND THE codePush.d.ts (typings) file!!!
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
     * Result status - there is an ongoing sync in progress, so this attempt to sync has been aborted.
     */
    IN_PROGRESS,
    
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

export = SyncStatus;
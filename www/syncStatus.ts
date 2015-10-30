/// <reference path="../typings/codePush.d.ts" />

"use strict";

/**
 * Defines the possible result statuses of the window.codePush.sync operation.
 */
enum SyncStatus {
    /**
     * The application is up to date.
     */
    UP_TO_DATE,
    
    /**
     * An update is available, it has been downloaded, unzipped and copied to the deployment folder.
     * After the completion of the callback invoked with SyncStatus.APPLY_SUCCESS, the application will be reloaded with the updated code and resources.
     */
    APPLY_SUCCESS,
    
    /**
     * An optional update is available, but the user declined to install it. The update was not downloaded.
     */
    UPDATE_IGNORED,
    
    /**
     * An error happened during the sync operation. This might be an error while communicating with the server, downloading or unziping the update.
     * The console logs should contain more information about what happened. No update has been applied in this case.
     */
    ERROR
}

export = SyncStatus;
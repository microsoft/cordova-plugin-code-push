// Type definitions for Apache Cordova CodePush plugin.
// Project: https://github.com/Microsoft/cordova-plugin-code-push
// 
// Copyright (c) Microsoft Corporation
// All rights reserved.
// Licensed under the MIT license.

declare module Http {
    export const enum Verb {
        GET, HEAD, POST, PUT, DELETE, TRACE, OPTIONS, CONNECT, PATCH
    }

    export interface Response {
        statusCode: number;
        body?: string;
    }

    export interface Requester {
        request(verb: Verb, url: string, callback: Callback<Response>): void;
        request(verb: Verb, url: string, requestBody: string, callback: Callback<Response>): void;
    }
}

interface Window {
    codePush: CodePushCordovaPlugin;
}

/**
 * Defines a package. All fields are non-nullable, except when retrieving the currently running package on the first run of the app, 
 * in which case only the appVersion is compulsory.
 * 
 * !! THIS TYPE IS READ FROM NATIVE CODE AS WELL. ANY CHANGES TO THIS INTERFACE NEEDS TO BE UPDATED IN NATIVE CODE !!
 */
interface IPackage {
    deploymentKey: string;
    description: string;
    label: string;
    appVersion: string;
    isMandatory: boolean;
    packageHash: string;
    packageSize: number;
    failedApply: boolean;
}

/**
 * Defines a remote package, which represents an update package available for download.
 */
interface IRemotePackage extends IPackage {
    /**
     * The URL at which the package is available for download.
     */
    downloadUrl: string;
    
    /**
     * Downloads the package update from the CodePush service.
     * 
     * @param downloadSuccess Called with one parameter, the downloaded package information, once the download completed successfully.
     * @param downloadError Optional callback invoked in case of an error.
     */
    download(downloadSuccess: SuccessCallback<ILocalPackage>, downloadError?: ErrorCallback): void;
    
    /**
     * Aborts the current download session, previously started with download().
     * 
     * @param abortSuccess Optional callback invoked if the abort operation succeeded.
     * @param abortError Optional callback invoked in case of an error.
     */
    abortDownload(abortSuccess?: SuccessCallback<void>, abortError?: ErrorCallback): void;
}

/**
 * Defines a local package. 
 * 
 * !! THIS TYPE IS READ FROM NATIVE CODE AS WELL. ANY CHANGES TO THIS INTERFACE NEEDS TO BE UPDATED IN NATIVE CODE !!
 */
interface ILocalPackage extends IPackage {
    /**
     * The local storage path where this package is located.
     */
    localPath: string;
    
    /**
     * Indicates if the current application run is the first one after the package was applied.
     */
    isFirstRun: boolean;
    
    /**
    * Applies this package to the application. The application will be reloaded with this package and on every application launch this package will be loaded.
    * If the rollbackTimeout parameter is provided, the application will wait for a navigator.codePush.notifyApplicationReady() for the given number of milliseconds.
    * If navigator.codePush.notifyApplicationReady() is called before the time period specified by rollbackTimeout, the apply operation is considered a success.
    * Otherwise, the apply operation will be marked as failed, and the application is reverted to its previous version.
    * 
    * @param applySuccess Callback invoked if the apply operation succeeded. 
    * @param applyError Optional callback inovoked in case of an error.
    * @param rollbackTimeout Optional time interval, in milliseconds, to wait for a notifyApplicationReady() call before marking the apply as failed and reverting to the previous version.
    */
    apply(applySuccess: SuccessCallback<void>, applyError?: ErrorCallback, rollbackTimeout?: number): void;
}

/**
 * Decomposed static side of RemotePackage.
 * For Class Decomposition guidelines see http://www.typescriptlang.org/Handbook#writing-dts-files-guidelines-and-specifics
 */
interface RemotePackage_Static {
    new (): IRemotePackage;
}

/**
 * Decomposed static side of LocalPackage.
 * For Class Decomposition guidelines see http://www.typescriptlang.org/Handbook#writing-dts-files-guidelines-and-specifics
 */
interface LocalPackage_Static {
    new (): ILocalPackage;
}

declare var RemotePackage: RemotePackage_Static;
declare var LocalPackage: LocalPackage_Static;

/**
 * Defines the JSON format of the current package information file.
 * This file is stored in the local storage of the device and persists between store updates and code-push updates.
 * 
 * !! THIS FILE IS READ FROM NATIVE CODE AS WELL. ANY CHANGES TO THIS INTERFACE NEEDS TO BE UPDATED IN NATIVE CODE !!
 */
interface IPackageInfoMetadata extends ILocalPackage {
    nativeBuildTime: string;
}

interface NativeUpdateNotification {
    updateAppVersion: boolean;   // Always true
    appVersion: string;
}

interface Callback<T> { (error: Error, parameter: T): void; }
interface SuccessCallback<T> { (result?: T): void; }
interface ErrorCallback { (error?: Error): void; }

interface Configuration {
    serverUrl: string;
    deploymentKey: string;
    ignoreAppVersion?: boolean;
}

declare class AcquisitionStatus {
    static DeploymentSucceeded: string;
    static DeploymentFailed: string;
}

declare class AcquisitionManager {
    constructor(httpRequester: Http.Requester, configuration: Configuration);
    public queryUpdateWithCurrentPackage(currentPackage: IPackage, callback?: Callback<IRemotePackage | NativeUpdateNotification>): void;
    public reportStatus(status: string, message?: string, callback?: Callback<void>): void;
}

interface CodePushCordovaPlugin {

    /**
     * Get the current package information.
     * 
     * @param packageSuccess Callback invoked with the currently deployed package information.
     * @param packageError Optional callback invoked in case of an error.
     */
    getCurrentPackage(packageSuccess: SuccessCallback<ILocalPackage>, packageError?: ErrorCallback): void;

    /**
     * Checks with the CodePush server if an update package is available for download.
     *
     * @param querySuccess Callback invoked in case of a successful response from the server.
     *                     The callback takes one RemotePackage parameter. A non-null package is a valid update.
     *                     A null package means the application is up to date for the current native application version.
     * @param queryError Optional callback invoked in case of an error.
     */
    checkForUpdate(querySuccess: SuccessCallback<IRemotePackage>, queryError?: ErrorCallback): void;
    
    /**
     * Notifies the plugin that the update operation succeeded and that the application is ready.
     * Calling this function is required if a rollbackTimeout parameter is used for your LocalPackage.apply() call.
     * If apply() is used without a rollbackTimeout, calling this function is a noop.
     * 
     * @param notifySucceeded Optional callback invoked if the plugin was successfully notified.
     * @param notifyFailed Optional callback invoked in case of an error during notifying the plugin.
     */
    notifyApplicationReady(notifySucceeded?: SuccessCallback<void>, notifyFailed?: ErrorCallback): void;

    /**
     * Convenience method for installing updates in one method call.
     * This method is provided for simplicity, and its behavior can be replicated by using window.codePush.checkForUpdate(), RemotePackage's download() and LocalPackage's apply() methods.
     *  
     * The algorithm of this method is the following:
     * - Checks for an update on the CodePush server.
     * - If an update is available
     *         - If the update is mandatory and the alertMessage is set in options, the user will be informed that the application will be updated to the latest version.
     *           The update package will then be downloaded and applied. 
     *         - If the update is not mandatory and the confirmMessage is set in options, the user will be asked if they want to update to the latest version.
     *           If they decline, the syncCallback will be invoked with SyncStatus.UPDATE_IGNORED. 
     *         - Otherwise, the update package will be downloaded and applied with no user interaction.
     * - If no update is available on the server, or if a previously rolled back update is available and the ignoreFailedUpdates is set to true, the syncCallback will be invoked with the SyncStatus.UP_TO_DATE.
     * - If an error ocurrs during checking for update, downloading or applying it, the syncCallback will be invoked with the SyncStatus.ERROR.
     * 
     * @param syncCallback Optional callback to be called with the status of the sync operation.
     *                     The callback will be called only once, and the possible statuses are defined by the SyncStatus enum. 
     * @param syncOptions Optional SyncOptions parameter configuring the behavior of the sync operation.
     * 
     */
    sync(syncCallback?: SuccessCallback<SyncStatus>, syncOptions?: SyncOptions): void;
}

/**
 * Defines the possible result statuses of the window.codePush.sync operation.
 */
declare enum SyncStatus {
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

/**
 * Defines the sync operation options.
 */
interface SyncOptions {
    /**
     * Optional time interval, in milliseconds, to wait for a notifyApplicationReady() call before marking the apply as failed and reverting to the previous version.
     * This is the rollbackTimeout parameter used for LocalPackage's apply() method call.
     */
    rollbackTimeout?: number;
    
    /**
     * Optional boolean flag. If set, previous updates which were rolled back will be ignored.
     */
    ignoreFailedUpdates?: boolean;
    
    /**
     * If a mandatory update is available and this option is set, the message will be displayed to the user in an alert dialog before downloading and installing the update.
     * The user will not be able to cancel the operation, since the update is mandatory.
     */
    mandatoryUpdateMessage?: string;
    
    /**
     * If an optional update is available and this option is set, the message will be displayed to the user in a confirmation dialog.
     * If the user confirms the update, it will be downloaded and installed. Otherwise, the update update is not downloaded.
     */
    optionalUpdateMessage?: string;
    
    /**
     * The title of the dialog box used for interacting with the user in case of a mandatory or optional update.
     * This title will only be used if at least one of mandatoryUpdateMessage or optionalUpdateMessage options are set.
     */
    updateTitle?: string;

    /**
     * The label of the confirmation button in case of an optional update.
     */
    optionalInstallButtonLabel?: string;
    
    /**
     * The label of the cancel button in case of an optional update.
     */
    optionalIgnoreButtonLabel?: string;
    
    /**
     * The label of the continue button in case of a mandatory update.
     */
    mandatoryContinueButtonLabel?: string;

    /**
     * Flag indicating if the update description provided by the CodePush server should be displayed in the dialog box appended to the update message.
     */
    appendReleaseDescription?: boolean;

    /**
     * Optional prefix to add to the release description.
     */
    descriptionPrefix?: string;
}

/**
 * Defines the JSON format of the package diff manifest file.
 */
interface IDiffManifest {
    deletedFiles: string[];
}
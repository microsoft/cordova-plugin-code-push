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
    public queryUpdateWithCurrentPackage(currentPackage: IPackage, callback?: Callback<IRemotePackage|NativeUpdateNotification>): void;
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
}

/**
 * Defines the JSON format of the package diff manifest file.
 */
interface IDiffManifest {
    deletedFiles: string[];
}
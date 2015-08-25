/**
 *******************************************************
 *                                                     *
 *   Copyright (C) Microsoft. All rights reserved.     *
 *                                                     *
 *******************************************************
 */

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

interface Navigator {
    codePush: CodePushCordovaPlugin;
}

/**
 * Defines a package. All fields are non-nullable, except when retrieving the currently running package on the first run of the app, 
 * in which case only the appVersion is compulsory.
 * 
 * !! THIS TYPE IS READ FROM NATIVE CODE AS WELL. ANY CHANGES TO THIS INTERFACE NEEDS TO BE UPDATED IN NATIVE CODE !!
 */
interface Package {
    deploymentKey: string;
    description: string;
    label: string;
    appVersion: string;
    isMandatory: boolean;
    packageHash: string;
    packageSize: number;
}

interface RemotePackage extends Package {
    downloadUrl: string;
}

interface NativeUpdateNotification {
    updateAppVersion: boolean;   // Always true
    appVersion: string;
}

/**
 * Defines a local package. 
 * 
 * !! THIS TYPE IS READ FROM NATIVE CODE AS WELL. ANY CHANGES TO THIS INTERFACE NEEDS TO BE UPDATED IN NATIVE CODE !!
 */
interface LocalPackage extends Package {
    localPath: string;
}

interface Callback<T> { (error: Error, parameter: T): void; }
interface SuccessCallback<T> { (result?: T): void; }
interface ErrorCallback { (error?: Error): void; }
interface OnUpdateCallback { (didUpdate?: boolean, oldPackage?: LocalPackage, newPackage?: LocalPackage): void; }

interface Configuration {
    serverUrl: string;
    deploymentKey: string;
    ignoreAppVersion?: boolean;
}

declare class AcquisitionManager {
    constructor(httpRequester: Http.Requester, configuration: Configuration);
    public queryUpdateWithCurrentPackage(currentPackage: Package, callback?: Callback<RemotePackage|NativeUpdateNotification>): void;
}

interface CodePushCordovaPlugin {
    /**
     * Checks if this is the first application run after an update has been applied.
     * The didUpdateCallback callback can be used for migrating data from the old app version to the new one.
     * 
     * @param didUpdateCallback Callback invoked with three parameters:
     *                          @param didUpdate boolean parameter indicating if this is the first run after an update.
     *                          @param oldPackage LocalPackage parameter - if didUpdate is true, this parameter will contain the old package information; otherwise it is undefined
     *                          @param newPackage LocalPackage parameter - if didUpdate is true, this parameter will contain the new package information; otherwise it is undefined
     */
    didUpdate(didUpdateCallback: OnUpdateCallback): void;

    /**
     * Queries the Code Push server for updates.
     *
     * @param querySuccess Callback invoked in case of a successful response from the server.
     *                     The callback takes one RemotePackage parameter. A non-null package is a valid update.
     *                     A null package means the application is up to date.
     * @param queryError Optional callback invoked in case of an error.
     */
    queryUpdate(querySuccess: SuccessCallback<RemotePackage>, queryError?: ErrorCallback): void;
    
    /**
     * Downloads a package update from the Code Push service.
     * 
     * @param package The package to download.
     * @param downloadSuccess Called with one parameter, the downloaded package information, once the download completed successfully.
     * @param downloadError Optional callback invoked in case of an error.
     */
    download(package: RemotePackage, downloadSuccess: SuccessCallback<LocalPackage>, downloadError?: ErrorCallback): void;
    
    /**
     * Aborts the current download session, previously started with download().
     * 
     * @param abortSuccess Optional callback invoked if the abort operation succeeded.
     * @param abortError Optional callback invoked in case of an error.
     */
    abortDownload(abortSuccess?: SuccessCallback<void>, abortError?: ErrorCallback): void;
    
    /**
     * Applies a downloaded package with revert protection.
     * If the updateSucceeded() method is not invoked in the time specified by applySuccessTimeoutMillis, the application will be reverted to its previous version.
     * 
     * @param newPackage The package update to apply.
     * @param applyTimeoutMillis The milliseconds interval to wait for updateSucceeded(). If in the given interval a call to updateSucceeded() has not been received, the application is reverted to its previous version.
     * @param applySuccess Callback invoked if the apply operation succeeded. This is the last callback to be invoked after the javascript context is reloaded in the application by launching the updated application.
     *                     Invocation of this callback does not guarantee that the application will not be reverted, since it is invoked before the applySuccessTimeoutMillis countdown starts.
     * @param applyError Optional callback inovoked in case of an error.
     */
    applyWithRevertProtection(newPackage: LocalPackage, applySuccessTimeoutMillis: number, applySuccess?: SuccessCallback<void>, applyError?: ErrorCallback): void;
    
    /**
     * Applies a downloaded package.
     * 
     * @param applySuccess Callback invoked if the apply operation succeeded. 
     * @param applyError Optional callback inovoked in case of an error.
     */
    apply(newPackage: LocalPackage, applySuccess?: SuccessCallback<void>, applyError?: ErrorCallback): void;

    /**
     * Notifies the plugin that the update operation succeeded.
     * Calling this function is required if applyWithRevertProtection() is used for your update.
     * If apply() was used for the update instead, calling this function is a noop.
     * 
     * @param notifySucceeded Optional callback invoked if the plugin was successfully notified.
     * @param notifyFailed Optional callback invoked in case of an error during notifying the plugin.
     */
    updateSucceeded(notifySucceeded?: SuccessCallback<void>, notifyFailed?: ErrorCallback): void;
    
    /**
     * Checks if a package update was previously attempted but failed for a given package hash.
     * Every reverted update attempted with applyWithRevertProtection() is stored such that the application developer has the option to ignore
     * updates that previously failed. This way, an infinite update loop can be prevented in case of a bad update package.
     * 
     * @param packageHash String hash of the package update to check.
     * @param checkSucceeded Callback taking one boolean parameter invoked with the result of the check.
     * @param checkFailed Optional callback invoked in case of an error.
     */
    hasUpdatePreviouslyFailed(packageHash: string, checkSucceeded: SuccessCallback<boolean>, checkFailed?: ErrorCallback): void;
    
    /**
     * Get the current package information.
     * 
     * @param packageSuccess Callback invoked with the currently deployed package information.
     * @param packageError Optional callback invoked in case of an error.
     */
    getCurrentPackage(packageSuccess: SuccessCallback<LocalPackage>, packageError?: ErrorCallback): void;
}
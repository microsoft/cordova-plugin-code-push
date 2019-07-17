/// <reference path="../typings/codePush.d.ts" />

"use strict";

declare var zip: any;

/**
 * Callback / error / logging utilities.
 */
class CodePushUtil {

    /**
     * Tag used for logging to the console.
     */
    private static TAG: string = "[CodePush]";

    /**
     * Performs a copy of all members of fromParameter to toParameter, with the condition that they are unassigned or null in toParameter.
     */
    public static copyUnassignedMembers(fromParameter: any, toParameter: any) {
        for (let key in fromParameter) {
            if ((<any>toParameter)[key] === undefined || (<any>toParameter)[key] === null) {
                (<any>toParameter)[key] = (<any>fromParameter)[key];
            }
        }
    }
    
    /**
     * Given two Cordova style callbacks for success and error, this function returns a node.js
     * style callback where the error is the first parameter and the result the second.
     */
    public static getNodeStyleCallbackFor<T>(successCallback: SuccessCallback<T>, errorCallback: { (error?: any): void; }): Callback<T> {
        return (error: any, result: T) => {
            if (error) {
                errorCallback && errorCallback(error);
            } else {
                successCallback && successCallback(result);
            }
        };
    }
    
    /**
     * Gets the message of an error, if any. Otherwise it returns the empty string.
     */
    public static getErrorMessage(e: Error): string {
        return e && e.message || e && e.toString() || "";
    }

    /**
     * Logs the error to the console and then forwards it to the provided ErrorCallback, if any.
     */
    public static invokeErrorCallback = (error: Error, errorCallback: ErrorCallback): void => {
        CodePushUtil.logError(null, error);
        errorCallback && errorCallback(error);
    }

    /**
     * Logs a message using the CodePush tag.
     */
    public static logMessage(msg: string): void {
        console.log(CodePushUtil.TAG + " " + msg);
    }
    
    /**
     * Logs an error message using the CodePush tag.
     */
    public static logError(message: String, error?: Error): void {
        const errorMessage = `${message || ""} ${CodePushUtil.getErrorMessage(error)}`;
        const stackTrace = error && error.stack ? `. StackTrace: ${error.stack}` : "";
        console.error(`${CodePushUtil.TAG} ${errorMessage}${stackTrace}`);
    }
}

export = CodePushUtil;

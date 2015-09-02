/// <reference path="../typings/codePush.d.ts" />

"use strict";

declare var zip: any;

/**
 * Callback / error utilities.
 */
class CallbackUtil {
	/**
     * Given two Cordova style callbacks for success and error, this function returns a node.js
     * style callback where the error is the first parameter and the result the second.
     */
    public static getNodeStyleCallbackFor<T>(successCallback: SuccessCallback<T>, errorCallback: ErrorCallback): Callback<T> {
        return (error: Error, result: T) => {
            if (error) {
                errorCallback && errorCallback(error);
            } else {
                successCallback && successCallback(result);
            }
        };
    }
    
    /**
     * Gets the message of an error, if any.
     */
    public static getErrorMessage(e: Error): string {
        var result: string;

        if (e && e.message) {
            return e.message;
        }

        return result;
    }
}

export = CallbackUtil;
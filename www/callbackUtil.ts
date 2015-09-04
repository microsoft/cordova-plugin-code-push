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
     * Gets the message of an error, if any.
     */
    public static getErrorMessage(e: Error): string {
        return e && e.message;
    }
}

export = CallbackUtil;
/**
 *******************************************************
 *                                                     *
 *   Copyright (C) Microsoft. All rights reserved.     *
 *                                                     *
 *******************************************************
 */
/// <reference path="./typings/codePush.d.ts" />
"use strict";
/**
 * XMLHttpRequest-based implementation of Http.Requester.
 */
var HttpRequester = (function () {
    function HttpRequester() {
    }
    /// <disable code="SA1001" justification="We are using optional parameters." />
    /// <disable code="SA9001" justification="We are using optional parameters." />
    HttpRequester.prototype.request = function (verb, url, callbackOrRequestBody, callback) {
        var requestBody;
        var requestCallback = callback;
        if (!requestCallback && typeof callbackOrRequestBody === "function") {
            requestCallback = callbackOrRequestBody;
        }
        if (typeof callbackOrRequestBody === "string") {
            requestBody = callbackOrRequestBody;
        }
        var xhr = new XMLHttpRequest();
        var methodName = this.getHttpMethodName(verb);
        var callbackInvoked = false;
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (callbackInvoked) {
                    console.warn("Callback already invoked before.");
                }
                var response = { statusCode: xhr.status, body: xhr.responseText };
                requestCallback && requestCallback(null, response);
                callbackInvoked = true;
            }
        };
        xhr.open(methodName, url, true);
        xhr.send(requestBody);
    };
    /// <enable code="SA9001" />
    /// <enable code="SA1001" />
    /**
     * Gets the HTTP method name as a string.
     * The reason for which this is needed is because the Http.Verb enum is defined as a constant => Verb[Verb.METHOD_NAME] is not defined in the compiled JS.
     */
    HttpRequester.prototype.getHttpMethodName = function (verb) {
        switch (verb) {
            case 0 /* GET */:
                return "GET";
            case 7 /* CONNECT */:
                return "CONNECT";
            case 4 /* DELETE */:
                return "DELETE";
            case 1 /* HEAD */:
                return "HEAD";
            case 6 /* OPTIONS */:
                return "OPTIONS";
            case 8 /* PATCH */:
                return "PATCH";
            case 2 /* POST */:
                return "POST";
            case 3 /* PUT */:
                return "PUT";
            case 5 /* TRACE */:
                return "TRACE";
            default:
                return null;
        }
    };
    return HttpRequester;
})();
module.exports = HttpRequester;

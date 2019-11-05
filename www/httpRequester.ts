/// <reference path="../typings/codePush.d.ts" />

"use strict";

import CodePushUtil = require("./codePushUtil");

declare var cordova: Cordova & { plugin: { http: AdvancedHttp.Plugin } };

/**
 * XMLHttpRequest-based implementation of Http.Requester.
 */
class HttpRequester implements Http.Requester {

    constructor(contentType?: string) {
        // Set headers for all requests
        cordova.plugin.http.setHeader("X-CodePush-Plugin-Name", "cordova-plugin-code-push");
        cordova.plugin.http.setHeader("X-CodePush-Plugin-Version", cordova.require("cordova/plugin_list").metadata["cordova-plugin-code-push"]);
        cordova.plugin.http.setHeader("X-CodePush-SDK-Version", cordova.require("cordova/plugin_list").metadata["code-push"]);
        if (contentType) {
            cordova.plugin.http.setHeader("Content-Type", contentType);
        }
    }

    public request(verb: Http.Verb, url: string, callbackOrRequestBody: Callback<Http.Response> | string, callback?: Callback<Http.Response>): void {
        var requestCallback: Callback<Http.Response> = callback;

        var options = HttpRequester.getInitialOptionsForVerb(verb);
        if (options instanceof Error) {
            CodePushUtil.logError("Could not make the HTTP request", options);
            requestCallback && requestCallback(options, undefined);
            return;
        }

        if (!requestCallback && typeof callbackOrRequestBody === "function") {
            requestCallback = <Callback<Http.Response>>callbackOrRequestBody;
        }

        if (typeof callbackOrRequestBody === "string") {
            // should be already JSON.stringify-ied, using plaintext serializer
            options.serializer = "utf8";
            options.data = <any>callbackOrRequestBody;
        }

        options.responseType = "text"; // Backward compatibility to xhr.responseText

        cordova.plugin.http.sendRequest(url, options, function(success) {
            requestCallback && requestCallback(null, {
                body: success.data, // this should be plaintext
                statusCode: success.status,
            });
        }, function(failure) {
            requestCallback && requestCallback(new Error(failure.error), null);
        });
    }

    /**
     * Builds the initial options object for the advanced-http plugin, if the HTTP method is supported.
     * The reason for which this is needed is because the Http.Verb enum corresponds to integer values from native runtime.
     */
    private static getInitialOptionsForVerb(verb: Http.Verb): AdvancedHttp.Options | Error {
        switch (verb) {
            case Http.Verb.GET:
                return { method: "get" };
            case Http.Verb.DELETE:
                return { method: "delete" };
            case Http.Verb.HEAD:
                return { method: "head" };
            case Http.Verb.PATCH:
                return { method: "patch" };
            case Http.Verb.POST:
                return { method: "post" };
            case Http.Verb.PUT:
                return { method: "put" };
            case Http.Verb.TRACE:
            case Http.Verb.OPTIONS:
            case Http.Verb.CONNECT:
            default:
                return new(class UnsupportedMethodError extends Error {})(`Unsupported HTTP method code [${verb}]`);
        }
    }
}

export = HttpRequester;

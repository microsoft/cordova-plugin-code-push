/// <reference path="../typings/codePush.d.ts" />

"use strict";

/**
 * XMLHttpRequest-based implementation of Http.Requester.
 */
class HttpRequester implements Http.Requester {
    public request(verb: Http.Verb, url: string, callbackOrRequestBody: Callback<Http.Response> | string, callback?: Callback<Http.Response>): void {
        var requestBody: string;
        var requestCallback: Callback<Http.Response> = callback;

        if (!requestCallback && typeof callbackOrRequestBody === "function") {
            requestCallback = <Callback<Http.Response>>callbackOrRequestBody;
        }

        if (typeof callbackOrRequestBody === "string") {
            requestBody = <string>callbackOrRequestBody;
        }

        var xhr = new XMLHttpRequest();
        var methodName = this.getHttpMethodName(verb);
        xhr.onreadystatechange = function(): void {
            if (xhr.readyState === 4) {
                var response: Http.Response = { statusCode: xhr.status, body: xhr.responseText };
                requestCallback && requestCallback(null, response);
            }
        };
        xhr.open(methodName, url, true);
        xhr.send(requestBody);
    }

    /**
     * Gets the HTTP method name as a string.
     * The reason for which this is needed is because the Http.Verb enum is defined as a constant => Verb[Verb.METHOD_NAME] is not defined in the compiled JS.
     */
    private getHttpMethodName(verb: Http.Verb): string {
        switch (verb) {
            case Http.Verb.GET:
                return "GET";
            case Http.Verb.CONNECT:
                return "CONNECT";
            case Http.Verb.DELETE:
                return "DELETE";
            case Http.Verb.HEAD:
                return "HEAD";
            case Http.Verb.OPTIONS:
                return "OPTIONS";
            case Http.Verb.PATCH:
                return "PATCH";
            case Http.Verb.POST:
                return "POST";
            case Http.Verb.PUT:
                return "PUT";
            case Http.Verb.TRACE:
                return "TRACE";
            default:
                return null;
        }
    }
}

export = HttpRequester;
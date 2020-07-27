
 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE DIRECTLY AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER, AND THEN RUN GULP. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.md. 
 *********************************************************************************************/ 


"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var CodePushUtil = require("./codePushUtil");
var HttpRequester = (function () {
    function HttpRequester(contentType) {
        cordova.plugin.http.setHeader("X-CodePush-Plugin-Name", "cordova-plugin-code-push");
        cordova.plugin.http.setHeader("X-CodePush-Plugin-Version", cordova.require("cordova/plugin_list").metadata["cordova-plugin-code-push"]);
        cordova.plugin.http.setHeader("X-CodePush-SDK-Version", cordova.require("cordova/plugin_list").metadata["code-push"]);
        if (contentType) {
            cordova.plugin.http.setHeader("Content-Type", contentType);
        }
    }
    HttpRequester.prototype.request = function (verb, url, callbackOrRequestBody, callback) {
        var requestCallback = callback;
        var options = HttpRequester.getInitialOptionsForVerb(verb);
        if (options instanceof Error) {
            CodePushUtil.logError("Could not make the HTTP request", options);
            requestCallback && requestCallback(options, undefined);
            return;
        }
        if (!requestCallback && typeof callbackOrRequestBody === "function") {
            requestCallback = callbackOrRequestBody;
        }
        if (typeof callbackOrRequestBody === "string") {
            options.serializer = "utf8";
            options.data = callbackOrRequestBody;
        }
        options.responseType = "text";
        cordova.plugin.http.sendRequest(url, options, function (success) {
            requestCallback && requestCallback(null, {
                body: success.data,
                statusCode: success.status,
            });
        }, function (failure) {
            requestCallback && requestCallback(new Error(failure.error), null);
        });
    };
    HttpRequester.getInitialOptionsForVerb = function (verb) {
        switch (verb) {
            case 0:
                return { method: "get" };
            case 4:
                return { method: "delete" };
            case 1:
                return { method: "head" };
            case 8:
                return { method: "patch" };
            case 2:
                return { method: "post" };
            case 3:
                return { method: "put" };
            case 5:
            case 6:
            case 7:
            default:
                return new ((function (_super) {
                    __extends(UnsupportedMethodError, _super);
                    function UnsupportedMethodError() {
                        return _super !== null && _super.apply(this, arguments) || this;
                    }
                    return UnsupportedMethodError;
                }(Error)))("Unsupported HTTP method code [" + verb + "]");
        }
    };
    return HttpRequester;
}());
module.exports = HttpRequester;

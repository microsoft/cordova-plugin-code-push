
 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE DIRECTLY AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER, AND THEN RUN GULP. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.md. 
 *********************************************************************************************/ 


"use strict";
var CodePushUtil = (function () {
    function CodePushUtil() {
    }
    CodePushUtil.copyUnassignedMembers = function (fromParameter, toParameter) {
        for (var key in fromParameter) {
            if (toParameter[key] === undefined || toParameter[key] === null) {
                toParameter[key] = fromParameter[key];
            }
        }
    };
    CodePushUtil.getNodeStyleCallbackFor = function (successCallback, errorCallback) {
        return function (error, result) {
            if (error) {
                errorCallback && errorCallback(error);
            }
            else {
                successCallback && successCallback(result);
            }
        };
    };
    CodePushUtil.getErrorMessage = function (e) {
        return e && e.message || e && e.toString() || "";
    };
    CodePushUtil.logMessage = function (msg) {
        console.log(CodePushUtil.TAG + " " + msg);
    };
    CodePushUtil.logError = function (message, error) {
        var errorMessage = (message || "") + " " + CodePushUtil.getErrorMessage(error);
        var stackTrace = error && error.stack ? ". StackTrace: " + error.stack : "";
        console.error(CodePushUtil.TAG + " " + errorMessage + stackTrace);
    };
    CodePushUtil.TAG = "[CodePush]";
    CodePushUtil.invokeErrorCallback = function (error, errorCallback) {
        CodePushUtil.logError(null, error);
        errorCallback && errorCallback(error);
    };
    return CodePushUtil;
}());
module.exports = CodePushUtil;


 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 ALSO, PLEASE DO NOT SUBMIT PULL REQUESTS WITH CHANGES TO THIS FILE. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.MD. 
 *********************************************************************************************/ 


/// <reference path="../typings/codePush.d.ts" />
"use strict";
var CallbackUtil = (function () {
    function CallbackUtil() {
    }
    CallbackUtil.getNodeStyleCallbackFor = function (successCallback, errorCallback) {
        return function (error, result) {
            if (error) {
                errorCallback && errorCallback(error);
            }
            else {
                successCallback && successCallback(result);
            }
        };
    };
    CallbackUtil.getErrorMessage = function (e) {
        var result;
        if (e && e.message) {
            return e.message;
        }
        return result;
    };
    return CallbackUtil;
})();
module.exports = CallbackUtil;

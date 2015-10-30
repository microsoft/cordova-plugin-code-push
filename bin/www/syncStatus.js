
 /******************************************************************************************** 
 	 THIS FILE HAS BEEN COMPILED FROM TYPESCRIPT SOURCES. 
 	 PLEASE DO NOT MODIFY THIS FILE AS YOU WILL LOSE YOUR CHANGES WHEN RECOMPILING. 
 	 ALSO, PLEASE DO NOT SUBMIT PULL REQUESTS WITH CHANGES TO THIS FILE. 
 	 INSTEAD, EDIT THE TYPESCRIPT SOURCES UNDER THE WWW FOLDER. 
 	 FOR MORE INFORMATION, PLEASE SEE CONTRIBUTING.md. 
 *********************************************************************************************/ 


/// <reference path="../typings/codePush.d.ts" />
"use strict";
var SyncStatus;
(function (SyncStatus) {
    SyncStatus[SyncStatus["UP_TO_DATE"] = 0] = "UP_TO_DATE";
    SyncStatus[SyncStatus["APPLY_SUCCESS"] = 1] = "APPLY_SUCCESS";
    SyncStatus[SyncStatus["UPDATE_IGNORED"] = 2] = "UPDATE_IGNORED";
    SyncStatus[SyncStatus["ERROR"] = 3] = "ERROR";
})(SyncStatus || (SyncStatus = {}));
module.exports = SyncStatus;

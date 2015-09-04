/// <reference path="../typings/codePush.d.ts" />

"use strict";

/**
 * Base class for Code Push packages.
 */
class Package implements IPackage {
    deploymentKey: string;
    description: string;
    label: string;
    appVersion: string;
    isMandatory: boolean;
    packageHash: string;
    packageSize: number;
    failedApply: boolean;
}

export = Package;
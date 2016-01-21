package com.microsoft.cordova;

/**
 * Defines the update installation options.
 */
public class InstallOptions {
    public InstallMode installMode;

    public InstallOptions(InstallMode installMode) {
        this.installMode = installMode;
    }
}

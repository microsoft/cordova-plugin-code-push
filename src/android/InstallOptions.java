package com.microsoft.cordova;

/**
 * Defines the update installation options.
 */
public class InstallOptions {
    public int rollbackTimeout;
    public InstallMode installMode;

    public InstallOptions(int rollbackTimeout, InstallMode installMode) {
        this.rollbackTimeout = rollbackTimeout;
        this.installMode = installMode;
    }
}

package com.microsoft.cordova;

import android.content.Context;

import org.json.JSONException;

import java.io.File;
import java.io.IOException;

/**
 * Handles update package management.
 */
public class CodePushPackageManager {

    public static final String CODEPUSH_OLD_PACKAGE_PATH = "/codepush/oldPackage.json";
    public static final String CODEPUSH_CURRENT_PACKAGE_PATH = "/codepush/currentPackage.json";

    private Context context;
    private CodePushPreferences codePushPreferences;

    public CodePushPackageManager(Context context, CodePushPreferences codePushPreferences) {
        this.context = context;
        this.codePushPreferences = codePushPreferences;
    }

    public void revertToPreviousVersion() {
        /* delete the failed update package */
        CodePushPackageMetadata failedUpdateMetadata = this.getCurrentPackageMetadata();
        if (failedUpdateMetadata != null) {
            if (failedUpdateMetadata.packageHash != null) {
                this.codePushPreferences.saveFailedUpdate(failedUpdateMetadata.packageHash);
            }
            File failedUpdateDir = new File(this.context.getFilesDir() + failedUpdateMetadata.localPath);
            if (failedUpdateDir.exists()) {
                Utilities.deleteEntryRecursively(failedUpdateDir);
            }
        }

        /* replace the current file with the old one */
        File currentFile = new File(this.context.getFilesDir() + CodePushPackageManager.CODEPUSH_CURRENT_PACKAGE_PATH);
        File oldFile = new File(this.context.getFilesDir() + CodePushPackageManager.CODEPUSH_OLD_PACKAGE_PATH);

        if (currentFile.exists()) {
            currentFile.delete();
        }

        if (oldFile.exists()) {
            oldFile.renameTo(currentFile);
        }
    }

    public void cleanDeployments() {
        File file = new File(this.context.getFilesDir() + "/codepush");
        if (file.exists()) {
            Utilities.deleteEntryRecursively(file);
        }
    }

    public void cleanOldPackage() throws IOException, JSONException {
        CodePushPackageMetadata oldPackageMetadata = this.getOldPackageMetadata();
        if (oldPackageMetadata != null) {
            File file = new File(this.context.getFilesDir() + oldPackageMetadata.localPath);
            if (file.exists()) {
                Utilities.deleteEntryRecursively(file);
            }
        }
    }

    public CodePushPackageMetadata getOldPackageMetadata() {
        String currentPackageFilePath = this.context.getFilesDir() + CODEPUSH_OLD_PACKAGE_PATH;
        return CodePushPackageMetadata.getPackageMetadata(currentPackageFilePath);
    }

    public CodePushPackageMetadata getCurrentPackageMetadata() {
        String currentPackageFilePath = this.context.getFilesDir() + CODEPUSH_CURRENT_PACKAGE_PATH;
        return CodePushPackageMetadata.getPackageMetadata(currentPackageFilePath);
    }

    public String getCachedBinaryHash() {
        return this.codePushPreferences.getCachedBinaryHash();
    }

    public void saveBinaryHash(String binaryHash) {
        this.codePushPreferences.saveBinaryHash(binaryHash);
    }

    public boolean isFailedUpdate(String packageHash) {
        return this.codePushPreferences.isFailedUpdate(packageHash);
    }

    public void clearFailedUpdates() {
        this.codePushPreferences.clearFailedUpdates();
    }

    public void savePendingInstall(InstallOptions options) {
        this.codePushPreferences.savePendingInstall(options);
    }

    public InstallOptions getPendingInstall() {
        return this.codePushPreferences.getPendingInstall();
    }

    public void clearPendingInstall() {
        this.codePushPreferences.clearPendingInstall();
    }

    public void markInstallNeedsConfirmation() {
        this.codePushPreferences.markInstallNeedsConfirmation();
    }

    public void clearInstallNeedsConfirmation() {
        this.codePushPreferences.clearInstallNeedsConfirmation();
    }

    public boolean installNeedsConfirmation() {
        return this.codePushPreferences.installNeedsConfirmation();
    }

    public boolean isBinaryFirstRun() {
        return this.codePushPreferences.isBinaryFirstRun();
    }

    public void clearBinaryFirstRunFlag() {
        this.codePushPreferences.clearBinaryFirstRunFlag();
    }

    public void saveBinaryFirstRunFlag() {
        this.codePushPreferences.saveBinaryFirstRunFlag();
    }
}

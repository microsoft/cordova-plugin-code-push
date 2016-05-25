package com.microsoft.cordova;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONException;

import java.util.HashSet;
import java.util.Set;

/**
 * Manages interaction with the Android preferences system.
 */
public class CodePushPreferences {

    private static final String BINARY_HASH_PREFERENCE = "BINARY_HASH";
    private static final String BINARY_HASH_PREFERENCE_KEY = "BINARY_HASH_KEY";
    private static final String FAILED_UPDATES_PREFERENCE = "FAILED_UPDATES";
    private static final String FAILED_UPDATES_KEY = "FAILED_UPDATES_KEY";
    private static final String PENDING_INSTALL_PREFERENCE = "PENDING_INSTALL";
    private static final String INSTALL_MODE_KEY = "INSTALL_MODE_KEY";
    private static final String INSTALL_MIN_BACKGROUND_DURATION = "INSTALL_MINIMUM_BACKGROUND_DURATION";
    private static final String INSTALL_NEEDS_CONFIRMATION = "INSTALL_NEEDS_CONFIRMATION";
    private static final String INSTALL_NEEDS_CONFIRMATION_KEY = "INSTALL_NEEDS_CONFIRMATION_KEY";
    private static final String FAILED_STATUS_REPORT_PREFERENCE = "CODE_PUSH_FAILED_STATUS_REPORT_PREFERENCE";
    private static final String FAILED_STATUS_REPORT_PREFERENCE_KEY = "CODE_PUSH_FAILED_STATUS_REPORT_PREFERENCE_KEY";
    private static final String FIRST_RUN_PREFERENCE = "CODE_PUSH_FIRST_RUN";
    private static final String FIRST_RUN_PREFERENCE_KEY = "CODE_PUSH_FIRST_RUN_KEY";
    private static final String LAST_VERSION_PREFERENCE = "CODE_PUSH_LAST_VERSION";
    private static final String LAST_VERSION_DEPLOYMENT_KEY_KEY = "LAST_VERSION_DEPLOYMENT_KEY_KEY";
    private static final String LAST_VERSION_LABEL_OR_APP_VERSION_KEY = "LAST_VERSION_LABEL_OR_APP_VERSION_KEY";

    private Context context;

    public CodePushPreferences(Context context) {
        this.context = context;
    }

    public String getCachedBinaryHash() {
        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.BINARY_HASH_PREFERENCE, Context.MODE_PRIVATE);
        return preferences.getString(CodePushPreferences.BINARY_HASH_PREFERENCE_KEY, null);
    }

    public void saveBinaryHash(String binaryHash) {
        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.BINARY_HASH_PREFERENCE, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = preferences.edit();
        editor.putString(CodePushPreferences.BINARY_HASH_PREFERENCE_KEY, binaryHash);
        editor.commit();
    }

    public void saveFailedUpdate(String hashCode) {
        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.FAILED_UPDATES_PREFERENCE, Context.MODE_PRIVATE);
        Set<String> failedUpdatesSet = preferences.getStringSet(CodePushPreferences.FAILED_UPDATES_KEY, null);
        if (failedUpdatesSet == null) {
            failedUpdatesSet = new HashSet<String>();
        }

        failedUpdatesSet.add(hashCode);
        SharedPreferences.Editor editor = preferences.edit();
        editor.putStringSet(CodePushPreferences.FAILED_UPDATES_KEY, failedUpdatesSet);
        editor.commit();
    }

    public boolean isFailedUpdate(String hashCode) {
        if (hashCode == null) {
            return false;
        }

        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.FAILED_UPDATES_PREFERENCE, Context.MODE_PRIVATE);
        Set<String> failedUpdatesSet = preferences.getStringSet(CodePushPreferences.FAILED_UPDATES_KEY, null);
        return (failedUpdatesSet != null && failedUpdatesSet.contains(hashCode));
    }

    public void clearFailedUpdates() {
        this.clearPreferences(CodePushPreferences.FAILED_UPDATES_PREFERENCE);
    }

    public void savePendingInstall(InstallOptions installOptions) {
        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.PENDING_INSTALL_PREFERENCE, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = preferences.edit();
        editor.putInt(CodePushPreferences.INSTALL_MODE_KEY, installOptions.installMode.getValue());
        editor.putInt(CodePushPreferences.INSTALL_MIN_BACKGROUND_DURATION, installOptions.minimumBackgroundDuration);
        editor.commit();
    }

    public void clearPendingInstall() {
        this.clearPreferences(CodePushPreferences.PENDING_INSTALL_PREFERENCE);
    }

    public InstallOptions getPendingInstall() {
        InstallOptions pendingInstall = null;

        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.PENDING_INSTALL_PREFERENCE, Context.MODE_PRIVATE);
        int installMode = preferences.getInt(CodePushPreferences.INSTALL_MODE_KEY, -1);
        int minimumBackgroundDuration = preferences.getInt(CodePushPreferences.INSTALL_MIN_BACKGROUND_DURATION, -1);

        if (installMode != -1 && minimumBackgroundDuration != -1) {
            pendingInstall = new InstallOptions(InstallMode.fromValue(installMode), minimumBackgroundDuration);
        }

        return pendingInstall;
    }

    public void markInstallNeedsConfirmation() {
        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.INSTALL_NEEDS_CONFIRMATION, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = preferences.edit();
        editor.putBoolean(CodePushPreferences.INSTALL_NEEDS_CONFIRMATION_KEY, true);
        editor.commit();
    }

    public void clearInstallNeedsConfirmation() {
        this.clearPreferences(CodePushPreferences.INSTALL_NEEDS_CONFIRMATION);
    }

    public boolean installNeedsConfirmation() {
        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.INSTALL_NEEDS_CONFIRMATION, Context.MODE_PRIVATE);
        boolean notConfirmedInstall = preferences.getBoolean(CodePushPreferences.INSTALL_NEEDS_CONFIRMATION_KEY, false);
        return notConfirmedInstall;
    }

    public void clearBinaryFirstRunFlag() {
        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.FIRST_RUN_PREFERENCE, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = preferences.edit();
        editor.remove(CodePushPreferences.FIRST_RUN_PREFERENCE_KEY);
        editor.commit();
    }

    public void saveBinaryFirstRunFlag() {
        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.FIRST_RUN_PREFERENCE, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = preferences.edit();
        editor.putBoolean(CodePushPreferences.FIRST_RUN_PREFERENCE_KEY, false);
        editor.commit();
    }

    public boolean isBinaryFirstRun() {
        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.FIRST_RUN_PREFERENCE, Context.MODE_PRIVATE);
        boolean isFirstRun = preferences.getBoolean(CodePushPreferences.FIRST_RUN_PREFERENCE_KEY, true);
        return isFirstRun;
    }

    public void clearPreferences(String preferencesId) {
        SharedPreferences preferences = context.getSharedPreferences(preferencesId, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = preferences.edit();
        editor.clear();
        editor.commit();
    }

    public void clearFailedReport() {
        this.clearPreferences(CodePushPreferences.FAILED_STATUS_REPORT_PREFERENCE);
    }

    public StatusReport getFailedReport() {
        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.FAILED_STATUS_REPORT_PREFERENCE, Context.MODE_PRIVATE);
        String statusReportJson = preferences.getString(CodePushPreferences.FAILED_STATUS_REPORT_PREFERENCE_KEY, null);
        try {
            return statusReportJson == null ? null : StatusReport.deserialize(statusReportJson);
        } catch (JSONException e) {
            // Should not happen
            e.printStackTrace();
            return null;
        }
    }

    public void saveFailedReport(StatusReport statusReport) {
        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.FAILED_STATUS_REPORT_PREFERENCE, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = preferences.edit();
        editor.putString(CodePushPreferences.FAILED_STATUS_REPORT_PREFERENCE_KEY, statusReport.serialize());
        editor.commit();
    }

    public void saveLastVersion(String labelOrAppVersion, String deploymentKey) {
        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.LAST_VERSION_PREFERENCE, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = preferences.edit();
        editor.putString(CodePushPreferences.LAST_VERSION_LABEL_OR_APP_VERSION_KEY, labelOrAppVersion);
        editor.putString(CodePushPreferences.LAST_VERSION_DEPLOYMENT_KEY_KEY, deploymentKey);
        editor.commit();
    }

    public String getLastVersionDeploymentKey() {
        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.LAST_VERSION_PREFERENCE, Context.MODE_PRIVATE);
        return preferences.getString(CodePushPreferences.LAST_VERSION_DEPLOYMENT_KEY_KEY, null);
    }

    public String getLastVersionLabelOrAppVersion() {
        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.LAST_VERSION_PREFERENCE, Context.MODE_PRIVATE);
        return preferences.getString(CodePushPreferences.LAST_VERSION_LABEL_OR_APP_VERSION_KEY, null);
    }
}

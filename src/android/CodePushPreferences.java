package com.microsoft.cordova;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.HashSet;
import java.util.Set;

/**
 * Manages interaction with the Android preferences system.
 */
public class CodePushPreferences {

    private static final String FAILED_UPDATES_PREFERENCE = "FAILED_UPDATES";
    private static final String FAILED_UPDATES_KEY = "FAILED_UPDATES_KEY";
    private static final String PENDING_INSTALL_PREFERENCE = "PENDING_INSTALL";
    private static final String INSTALL_MODE_KEY = "INSTALL_MODE_KEY";
    private static final String INSTALL_NOT_CONFIRMED_PREFERENCE = "INSTALL_NOT_CONFIRMED";
    private static final String INSTALL_NOT_CONFIRMED_KEY = "INSTALL_NOT_CONFIRMED_KEY";

    private Context context;

    public CodePushPreferences(Context context) {
        this.context = context;
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
        editor.commit();
    }

    public void clearPendingInstall() {
        this.clearPreferences(CodePushPreferences.PENDING_INSTALL_PREFERENCE);
    }

    public InstallOptions getPendingInstall() {
        InstallOptions pendingInstall = null;

        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.PENDING_INSTALL_PREFERENCE, Context.MODE_PRIVATE);
        int installMode = preferences.getInt(CodePushPreferences.INSTALL_MODE_KEY, -1);

        if (installMode != -1) {
            pendingInstall = new InstallOptions(InstallMode.fromValue(installMode));
        }

        return pendingInstall;
    }

    public void saveNotConfirmedInstall() {
        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.INSTALL_NOT_CONFIRMED_PREFERENCE, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = preferences.edit();
        editor.putBoolean(CodePushPreferences.INSTALL_NOT_CONFIRMED_KEY, true);
        editor.commit();
    }

    public void clearNotConfirmedInstall() {
        this.clearPreferences(CodePushPreferences.INSTALL_NOT_CONFIRMED_PREFERENCE);
    }

    public boolean isNotConfirmedInstall() {
        SharedPreferences preferences = context.getSharedPreferences(CodePushPreferences.INSTALL_NOT_CONFIRMED_PREFERENCE, Context.MODE_PRIVATE);
        boolean notConfirmedInstall = preferences.getBoolean(CodePushPreferences.INSTALL_NOT_CONFIRMED_KEY, false);
        return notConfirmedInstall;
    }

    public void clearPreferences(String preferencesId) {
        SharedPreferences preferences = context.getSharedPreferences(preferencesId, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = preferences.edit();
        editor.clear();
        editor.commit();
    }
}

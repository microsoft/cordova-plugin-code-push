package com.microsoft.cordova;

import org.apache.cordova.CordovaWebView;

import java.util.ArrayList;
import java.util.Locale;
import android.app.Activity;

/**
 * Handles the native -> JS reporting mechanism.
 */
public class CodePushReportingManager {

    private Activity cordovaActivity;
    private CodePushPreferences codePushPreferences;

    /**
     * Defines application statuses we use in reporting events from the native to the JS layer.
     */
    public static enum Status {
        STORE_VERSION(0),
        UPDATE_CONFIRMED(1),
        UPDATE_ROLLED_BACK(2);

        private int value;

        Status(int i) {
            this.value = i;
        }

        /**
         * Returns the value associated with this enum.
         */
        public int getValue() {
            return this.value;
        }
    }

    public CodePushReportingManager(Activity cordovaActivity, CodePushPreferences codePushPreferences) {
        this.cordovaActivity = cordovaActivity;
        this.codePushPreferences = codePushPreferences;
    }

    /**
     * Invokes the window.codePush.reportStatus JS function for the given webView.
     */
    public void reportStatus(Status status, String label, String appVersion, String deploymentKey, final CordovaWebView webView) {
        /* JS function to call: window.codePush.reportStatus(status: number, label: String, appVersion: String, currentDeploymentKey: String, previousLabelOrAppVersion?: string, previousDeploymentKey?: string) */
        final String script = String.format(
            Locale.US,
            "javascript:window.codePush.reportStatus(%d, %s, %s, %s, %s, %s)",
            status.getValue(),
            convertStringParameter(label),
            convertStringParameter(appVersion),
            convertStringParameter(deploymentKey),
            convertStringParameter(codePushPreferences.getLastVersionLabelOrAppVersion()),
            convertStringParameter(codePushPreferences.getLastVersionDeploymentKey())
            );

        if (status == Status.STORE_VERSION || status == Status.UPDATE_CONFIRMED) {
            codePushPreferences.saveLastVersion(label == null ? appVersion : label, deploymentKey);
        }

        cordovaActivity.runOnUiThread(new Runnable() {
            public void run() {
                webView.loadUrl(script);
            }
        });
    }

    private String convertStringParameter(String input) {
        if (null == input) {
            return "undefined";
        } else {
            return "'" + input + "'";
        }
    }
}

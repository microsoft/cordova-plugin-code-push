package com.microsoft.cordova;

import org.apache.cordova.CordovaWebView;

import java.util.ArrayList;
import java.util.Locale;

/**
 * Handles the native -> JS reporting mechanism.
 */
public class Reporting {

    private static ArrayList<PendingStatus> PendingStatuses = new ArrayList<PendingStatus>();

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

    /**
     * Model class used to store reports that are pending delivery to the native side.
     */
    public static class PendingStatus {
        public PendingStatus(Status status, String label, String appVersion, String deploymentKey) {
            this.status = status;
            this.label = label;
            this.appVersion = appVersion;
            this.deploymentKey = deploymentKey;
        }

        public Status status;
        public String label;
        public String appVersion;
        public String deploymentKey;
    }

    /**
     * Saves a new status to be reported.
     */
    public static synchronized void saveStatus(Status status, String label, String appVersion, String deploymentKey) {
        try {
            PendingStatus pendingStatus = new PendingStatus(status, label, appVersion, deploymentKey);
            PendingStatuses.add(pendingStatus);
        } catch (Exception e) {
            Utilities.logException(e);
        }
    }

    /**
     * Reports all the statuses back to the JS layer.
     */
    public static synchronized void reportStatuses(CordovaWebView webView) {
        try {
            for (PendingStatus report : PendingStatuses) {
                reportStatus(report, webView);
            }

            Reporting.PendingStatuses.clear();
        } catch (Exception e) {
            Utilities.logException(e);
        }
    }

    /**
     * Invokes the window.codePush.reportStatus JS function for the given webView.
     */
    private static void reportStatus(PendingStatus pendingStatus, CordovaWebView webView) {
        /* report status to the JS layer */
        String labelParameter = convertStringParameter(pendingStatus.label);
        String appVersionParameter = convertStringParameter(pendingStatus.appVersion);
        String deploymentKeyParameter = convertStringParameter(pendingStatus.deploymentKey);

        /* JS function to call: window.codePush.reportStatus(status: number, label: String, appVersion: String, deploymentKey: String) */
        String script = String.format(Locale.US, "javascript:window.codePush.reportStatus(%d, %s, %s, %s)", pendingStatus.status.getValue(), labelParameter, appVersionParameter, deploymentKeyParameter);
        webView.loadUrl(script);
    }

    private static String convertStringParameter(String input) {
        if (null == input) {
            return "undefined";
        } else {
            return "'" + input + "'";
        }
    }
}

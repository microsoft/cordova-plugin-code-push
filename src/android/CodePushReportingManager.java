package com.microsoft.cordova;

import org.apache.cordova.CordovaWebView;

import java.util.Locale;
import android.app.Activity;

/**
 * Handles the native -> JS reporting mechanism.
 */
public class CodePushReportingManager {

    private Activity cordovaActivity;
    private CodePushPreferences codePushPreferences;
    private Boolean hasFailedReport = null;

    public CodePushReportingManager(Activity cordovaActivity, CodePushPreferences codePushPreferences) {
        this.cordovaActivity = cordovaActivity;
        this.codePushPreferences = codePushPreferences;
    }

    /**
     * Invokes the window.codePush.reportStatus JS function for the given webView.
     */
    public void reportStatus(StatusReport statusReport, final CordovaWebView webView) {
        /* JS function to call: window.codePush.reportStatus(status: number, label: String, appVersion: String, currentDeploymentKey: String, previousLabelOrAppVersion?: string, previousDeploymentKey?: string) */
        if (statusReport.deploymentKey == null || statusReport.deploymentKey.isEmpty()) {
            return;
        }

        final String script = String.format(
            Locale.US,
            "javascript:document.addEventListener(\"deviceready\", function () { window.codePush.reportStatus(%d, %s, %s, %s, %s, %s); });",
            statusReport.status.getValue(),
            convertStringParameter(statusReport.label),
            convertStringParameter(statusReport.appVersion),
            convertStringParameter(statusReport.deploymentKey),
            statusReport.lastVersionLabelOrAppVersion == null ? convertStringParameter(codePushPreferences.getLastVersionLabelOrAppVersion()) : convertStringParameter(statusReport.lastVersionLabelOrAppVersion),
            statusReport.lastVersionDeploymentKey == null ? convertStringParameter(codePushPreferences.getLastVersionDeploymentKey()) : convertStringParameter(statusReport.lastVersionDeploymentKey)
        );

        cordovaActivity.runOnUiThread(new Runnable() {
            public void run() {
                webView.loadUrl(script);
            }
        });
    }

    public boolean hasFailedReport() {
        if (hasFailedReport == null) {
            hasFailedReport = codePushPreferences.getFailedReport() != null;
        }

        return hasFailedReport;
    }

    public StatusReport getAndClearFailedReport() {
        StatusReport failedReport = codePushPreferences.getFailedReport();
        codePushPreferences.clearFailedReport();
        this.hasFailedReport = false;
        return failedReport;
    }

    public void saveFailedReport(StatusReport statusReport) {
        codePushPreferences.saveFailedReport(statusReport);
        this.hasFailedReport = true;
    }

    public void saveSuccessfulReport(StatusReport statusReport) {
        if (statusReport.status == ReportingStatus.STORE_VERSION || statusReport.status == ReportingStatus.UPDATE_CONFIRMED) {
            codePushPreferences.saveLastVersion(statusReport.label == null ? statusReport.appVersion : statusReport.label, statusReport.deploymentKey);
            codePushPreferences.clearFailedReport();
            this.hasFailedReport = false;
        }
    }

    private String convertStringParameter(String input) {
        if (null == input) {
            return "undefined";
        } else {
            return "'" + input + "'";
        }
    }
}

package com.microsoft.cordova;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Represents a status report to be sent to metrics.
 */
public class StatusReport {

    private static final String STATUS_KEY = "status";
    private static final String LABEL_KEY = "label";
    private static final String APP_VERSION_KEY = "appVersion";
    private static final String DEPLOYMENT_KEY_KEY = "deploymentKey";
    private static final String LAST_VERSION_LABEL_OR_APP_VERSION_KEY = "lastVersionLabelOrAppVersion";
    private static final String LAST_VERSION_DEPLOYMENT_KEY_KEY = "lastVersionDeploymentKey";

    ReportingStatus status;
    String label;
    String appVersion;
    String deploymentKey;

    // Optional fields.
    String lastVersionLabelOrAppVersion;
    String lastVersionDeploymentKey;

    public StatusReport(int status, String label, String appVersion, String deploymentKey, String lastVersionLabelOrAppVersion, String lastVersionDeploymentKey) {
        this(ReportingStatus.values()[status], label, appVersion, deploymentKey, lastVersionLabelOrAppVersion, lastVersionDeploymentKey);
    }

    public StatusReport(ReportingStatus status, String label, String appVersion, String deploymentKey) {
        this(status, label, appVersion, deploymentKey, null, null);
    }

    public StatusReport(ReportingStatus status, String label, String appVersion, String deploymentKey, String lastVersionLabelOrAppVersion, String lastVersionDeploymentKey) {
        this.status = status;
        this.label = label;
        this.appVersion = appVersion;
        this.deploymentKey = deploymentKey;
        this.lastVersionLabelOrAppVersion = lastVersionLabelOrAppVersion;
        this.lastVersionDeploymentKey = lastVersionDeploymentKey;
    }

    public String serialize() {
        try {
            JSONObject jsonObject = new JSONObject();
            jsonObject.put(STATUS_KEY, status.getValue());
            jsonObject.put(LABEL_KEY, label);
            jsonObject.put(APP_VERSION_KEY, appVersion);
            if (deploymentKey != null) {
                jsonObject.put(DEPLOYMENT_KEY_KEY, deploymentKey);
            }

            if (lastVersionLabelOrAppVersion != null) {
                jsonObject.put(LAST_VERSION_LABEL_OR_APP_VERSION_KEY, lastVersionLabelOrAppVersion);
            }

            if (lastVersionDeploymentKey != null) {
                jsonObject.put(LAST_VERSION_DEPLOYMENT_KEY_KEY, lastVersionDeploymentKey);
            }

            return jsonObject.toString();
        } catch (JSONException e) {
            // Should not happen
            e.printStackTrace();
            return null;
        }
    }

    public static StatusReport deserialize(JSONObject jsonObject) throws JSONException {
        return new StatusReport(
                jsonObject.optInt(STATUS_KEY),
                jsonObject.optString(LABEL_KEY, null),
                jsonObject.optString(APP_VERSION_KEY, null),
                jsonObject.optString(DEPLOYMENT_KEY_KEY, null),
                jsonObject.optString(LAST_VERSION_LABEL_OR_APP_VERSION_KEY, null),
                jsonObject.optString(LAST_VERSION_DEPLOYMENT_KEY_KEY, null)
        );
    }

    public static StatusReport deserialize(String jsonString) throws JSONException {
        JSONObject jsonObject = new JSONObject(jsonString);
        return deserialize(jsonObject);
    }
}
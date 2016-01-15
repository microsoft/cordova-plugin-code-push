package com.microsoft.cordova;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.PluginResult;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Handles the native -> JS reporting mechanism.
 */
public class Reporting {

    private static CallbackContext reportingCallbackContext;
    private static JSONArray pendingStatuses = new JSONArray();

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
     * Reporting callback context setter.
     */
    public static void setReportingCallbackContext(CallbackContext reportingCallbackContext) {
        Reporting.reportingCallbackContext = reportingCallbackContext;
    }

    /**
     * Saves a new status to be reported.
     */
    public static synchronized void saveStatus(Status status, String label, String appVersion) {
        try {
            JSONObject object = new JSONObject();
            object.put("status", status.getValue());
            object.put("label", label);
            object.put("appVersion", appVersion);
            pendingStatuses.put(object);
        } catch (Exception e) {
            Utilities.logException(e);
        }
    }

    /**
     * Reports all the statuses back to the JS layer.
     */
    public static synchronized void reportStatuses() {
        try {
            if (pendingStatuses != null && pendingStatuses.length() > 0) {
                if (null != reportingCallbackContext) {
                    PluginResult result = new PluginResult(PluginResult.Status.OK, pendingStatuses);
                    result.setKeepCallback(true);
                    reportingCallbackContext.sendPluginResult(result);
                }

                // JSONArray.remove requires API level 19
                // use re-instantiation instead of clearing the array
                pendingStatuses = new JSONArray();
            }
        } catch (Exception e) {
            Utilities.logException(e);
        }
    }
}

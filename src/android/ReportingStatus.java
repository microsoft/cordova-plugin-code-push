package com.microsoft.cordova;

/**
 * Defines application statuses we use in reporting events from the native to the JS layer.
 */
public enum ReportingStatus {
    STORE_VERSION(0),
    UPDATE_CONFIRMED(1),
    UPDATE_ROLLED_BACK(2);

    private int value;

    ReportingStatus(int i) {
        this.value = i;
    }

    /**
     * Returns the value associated with this enum.
     */
    public int getValue() {
        return this.value;
    }
}
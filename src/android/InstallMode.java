package com.microsoft.cordova;

/**
 * Defines the available InstallModes.
 */
public enum InstallMode {
    IMMEDIATE(0),
    ON_NEXT_RESTART(1),
    ON_NEXT_RESUME(2);

    private int value;

    InstallMode(int i) {
        this.value = i;
    }

    /**
     * Returns the InstallMode associated with a given value.
     * If no InstallMode is associated with the provided value, null is returned.
     */
    public static InstallMode fromValue(int i) {
        for (InstallMode mode : InstallMode.values()) {
            if (i == mode.value) {
                return mode;
            }
        }

        return null;
    }

    /**
     * Returns the value associated with this enum.
     */
    public int getValue() {
        return this.value;
    }
}

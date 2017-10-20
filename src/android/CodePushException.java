package com.microsoft.cordova;

/**
 * Created by kgoranchev on 19/10/2017.
 */

public class CodePushException extends Exception {
    public CodePushException() {
    }

    public CodePushException(String message) {
        super(message);
    }

    public CodePushException(String message, Throwable cause) {
        super(message, cause);
    }

    public CodePushException(Throwable cause) {
        super(cause);
    }

    public CodePushException(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
        super(message, cause, enableSuppression, writableStackTrace);
    }
}

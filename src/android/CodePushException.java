package com.microsoft.cordova;

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
}

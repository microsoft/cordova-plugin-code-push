/**
 * Defines the available install modes for updates.
 */
enum InstallMode {
    /**
     * The update will be applied to the running application immediately. The application will be reloaded with the new content immediately.
     */
    IMMEDIATE,
    
    /**
     * The update is downloaded but not installed immediately. The new content will be available the next time the application is started.
     */
    ON_NEXT_RESTART,
    
    /**
     * The udpate is downloaded but not installed immediately. The new content will be available the next time the application is resumed or restarted, whichever event happends first.
     */
    ON_NEXT_RESUME
}

export = InstallMode;
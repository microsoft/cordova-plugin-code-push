package com.microsoft.cordova;

import android.content.pm.PackageManager;
import android.os.CountDownTimer;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.ConfigXmlParser;
import org.apache.cordova.CordovaArgs;
import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CordovaWebView;
import org.json.JSONException;

import java.io.File;
import java.net.MalformedURLException;

/**
 * Native Android CodePush Cordova Plugin.
 */
public class CodePush extends CordovaPlugin {

    private static final String WWW_ASSET_PATH_PREFIX = "file:///android_asset/www/";
    public static final String RESOURCES_BUNDLE = "resources.arsc";

    private CordovaWebView mainWebView;
    private CodePushPackageManager codePushPackageManager;
    private boolean pluginDestroyed = false;
    private boolean didUpdate = false;
    private boolean didStartApp = false;
    private static boolean InstallSucceeded = false;
    private static boolean ShouldClearHistoryOnLoad = false;

    @Override
    public void initialize(CordovaInterface cordova, CordovaWebView webView) {
        super.initialize(cordova, webView);
        codePushPackageManager = new CodePushPackageManager(cordova.getActivity());
        mainWebView = webView;
    }

    @Override
    public boolean execute(String action, CordovaArgs args, final CallbackContext callbackContext) {
        if ("getServerURL".equals(action)) {
            this.returnStringPreference("codepushserverurl", callbackContext);
            return true;
        } else if ("getDeploymentKey".equals(action)) {
            this.returnStringPreference("codepushdeploymentkey", callbackContext);
            return true;
        } else if ("getNativeBuildTime".equals(action)) {
            return execGetNativeBuildTime(callbackContext);
        } else if ("getAppVersion".equals(action)) {
            return execGetAppVersion(callbackContext);
        } else if ("preInstall".equals(action)) {
            return execPreInstall(args, callbackContext);
        } else if ("install".equals(action)) {
            return execInstall(args, callbackContext);
        } else if ("updateSuccess".equals(action)) {
            CodePush.InstallSucceeded = true;
            callbackContext.success();
            return true;
        } else if ("isFailedUpdate".equals(action)) {
            return execIsFailedUpdate(args, callbackContext);
        } else if ("isFirstRun".equals(action)) {
            execIsFirstRun(args, callbackContext);
            return true;
        } else {
            return false;
        }
    }

    private void execIsFirstRun(CordovaArgs args, CallbackContext callbackContext) {
        try {
            boolean isFirstRun = false;
            String packageHash = args.getString(0);
            CodePushPackageMetadata currentPackageMetadata = codePushPackageManager.getCurrentPackageMetadata();
            if (null != currentPackageMetadata) {
                /* This is the first run for a package if we just updated, and the current package hash matches the one provided. */
                isFirstRun = (null != packageHash
                        && !packageHash.isEmpty()
                        && packageHash.equals(currentPackageMetadata.packageHash)
                        && didUpdate);
            }
            callbackContext.success(isFirstRun ? 1 : 0);
        } catch (JSONException e) {
            callbackContext.error("Invalid package hash. " + e.getMessage());
        }
    }

    private boolean execIsFailedUpdate(CordovaArgs args, CallbackContext callbackContext) {
        try {
            final String packageHash = args.getString(0);
            boolean isFailedUpdate = this.codePushPackageManager.isFailedUpdate(packageHash);
            callbackContext.success(isFailedUpdate ? 1 : 0);
        } catch (JSONException e) {
            callbackContext.error("Could not read the package hash: " + e.getMessage());
        }
        return true;
    }

    private boolean execInstall(CordovaArgs args, CallbackContext callbackContext) {
        try {
            final String startLocation = args.getString(0);
            final int updateSuccessTimeoutInMillis = args.optInt(1);
            final InstallMode installMode = InstallMode.fromValue(args.optInt(2));

            File startPage = this.getStartPageForPackage(startLocation);
            if (startPage != null) {
                /* start page file exists */
                /* navigate to the start page */
                if (InstallMode.IMMEDIATE.equals(installMode)) {
                    this.navigateToFile(startPage);
                    markUpdateAndStartTimer(updateSuccessTimeoutInMillis);
                } else {
                    InstallOptions pendingInstall = new InstallOptions(updateSuccessTimeoutInMillis, installMode);
                    this.codePushPackageManager.savePendingInstall(pendingInstall);
                }

                callbackContext.success();
            } else {
                callbackContext.error("Could not find the package start page.");
            }
        } catch (Exception e) {
            callbackContext.error("Cound not read webview URL: " + e.getMessage());
        }
        return true;
    }

    private void markUpdateAndStartTimer(int updateSuccessTimeoutInMillis) {
    /* this flag will clear when reloading the plugin */
        this.didUpdate = true;

        if (updateSuccessTimeoutInMillis > 0) {
            startRollbackTimeout(updateSuccessTimeoutInMillis);
        } else {
            cleanOldPackageSilently();
        }
    }

    private void startRollbackTimeout(final int updateSuccessTimeoutInMillis) {
    /* start countdown for success */
        CodePush.InstallSucceeded = false;
        final CountDownTimer successTimer = new CountDownTimer(updateSuccessTimeoutInMillis, updateSuccessTimeoutInMillis) {
            @Override
            public void onTick(long millisUntilFinished) {
                /* empty - no need for progress updates */
            }

            @Override
            public void onFinish() {
                onSuccessTimerFinish();
            }
        };
        successTimer.start();
    }

    private boolean execPreInstall(CordovaArgs args, CallbackContext callbackContext) {
    /* check if package is valid */
        try {
            final String startLocation = args.getString(0);
            File startPage = this.getStartPageForPackage(startLocation);
            if (startPage != null) {
                /* start page exists */
                callbackContext.success();
            } else {
                callbackContext.error("Could not get the package start page");
            }
        } catch (Exception e) {
            callbackContext.error("Could not get the package start page");
        }
        return true;
    }

    private boolean execGetAppVersion(CallbackContext callbackContext) {
        try {
            String appVersionName = Utilities.getAppVersionName(this.cordova.getActivity());
            callbackContext.success(appVersionName);
        } catch (PackageManager.NameNotFoundException e) {
            callbackContext.error("Cannot get application version.");
        }
        return true;
    }

    private boolean execGetNativeBuildTime(CallbackContext callbackContext) {
        long millis = Utilities.getApkEntryBuildTime(RESOURCES_BUNDLE, this.cordova.getActivity());
        if (millis == -1) {
            callbackContext.error("Could not get the application buildstamp.");
        } else {
            String result = String.valueOf(millis);
            callbackContext.success(result);
        }
        return true;
    }

    private void onSuccessTimerFinish() {
        if (!CodePush.InstallSucceeded) {
            /* revert application to the previous version */
            this.codePushPackageManager.revertToPreviousVersion();
            String url;
            try {
                CodePushPackageMetadata currentPackageMetadata = this.codePushPackageManager.getCurrentPackageMetadata();
                url = this.getStartPageURLForPackage(currentPackageMetadata.localPath);
            } catch (Exception e) {
                url = this.getConfigLaunchUrl();
            }

            final String finalURL = url;

            if (!this.pluginDestroyed) {
                this.cordova.getActivity().runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        navigateToURL(finalURL);
                    }
                });
            }
        } else {
            /* success updating - delete the old package */
            cleanOldPackageSilently();
        }
    }

    private void cleanOldPackageSilently() {
        try {
            this.codePushPackageManager.cleanOldPackage();
        } catch (Exception e) {
            /* silently fail if there was an error during cleanup */
            Utilities.logException(e);
        }
    }

    private void returnStringPreference(String preferenceName, CallbackContext callbackContext) {
        String result = mainWebView.getPreferences().getString(preferenceName, null);
        if (result != null) {
            callbackContext.success(result);
        } else {
            callbackContext.error("Could not get preference: " + preferenceName);
        }
    }

    private void handleAppStart() {
        try {
            /* check if we have a deployed package already */
            CodePushPackageMetadata deployedPackageMetadata = this.codePushPackageManager.getCurrentPackageMetadata();
            if (deployedPackageMetadata != null) {
                String deployedPackageTimeStamp = deployedPackageMetadata.nativeBuildTime;
                long nativeBuildTime = Utilities.getApkEntryBuildTime(RESOURCES_BUNDLE, this.cordova.getActivity());
                if (nativeBuildTime != -1) {
                    String currentAppTimeStamp = String.valueOf(nativeBuildTime);
                    if ((deployedPackageTimeStamp != null) && (currentAppTimeStamp != null)) {
                        if (deployedPackageTimeStamp.equals(currentAppTimeStamp)) {
                            /* same native version, safe to launch from local storage */
                            if (deployedPackageMetadata.localPath != null) {
                                File startPage = this.getStartPageForPackage(deployedPackageMetadata.localPath);
                                if (startPage != null) {
                                    /* file exists */
                                    navigateToFile(startPage);
                                }
                            }
                        } else {
                            /* application updated in the store or via local deployment */
                            this.codePushPackageManager.cleanDeployments();
                            this.codePushPackageManager.clearFailedUpdates();
                            this.codePushPackageManager.clearPendingInstall();
                        }
                    }
                }
            }
        } catch (Exception e) {
            /* empty - if there is an exception, the app will launch with the bundled content */
        }
    }

    private void navigateToFile(File startPageFile) throws MalformedURLException {
        if (startPageFile != null) {
            String url = startPageFile.toURI().toURL().toString();
            this.navigateToURL(url);
        }
    }

    private void navigateToURL(String url) {
        if (url != null) {
            CodePush.ShouldClearHistoryOnLoad = true;
            this.mainWebView.loadUrlIntoView(url, false);
        }
    }

    private File getStartPageForPackage(String packageLocation) {
        if (packageLocation != null) {
            File startPage = new File(this.cordova.getActivity().getFilesDir() + packageLocation, "www/" + getConfigStartPageName());
            if (startPage.exists()) {
                return startPage;
            }
        }

        return null;
    }

    private String getStartPageURLForPackage(String packageLocation) throws MalformedURLException {
        String result = null;
        File startPageFile = getStartPageForPackage(packageLocation);
        if (startPageFile != null) {
            result = startPageFile.toURI().toURL().toString();
        }

        return result;
    }

    private String getConfigStartPageName() {
        String launchUrl = this.getConfigLaunchUrl();
        int launchUrlLength = launchUrl.length();
        if (launchUrl.startsWith(CodePush.WWW_ASSET_PATH_PREFIX)) {
            launchUrl = launchUrl.substring(CodePush.WWW_ASSET_PATH_PREFIX.length(), launchUrlLength);
        }

        return launchUrl;
    }

    private String getConfigLaunchUrl() {
        ConfigXmlParser parser = new ConfigXmlParser();
        parser.parse(this.cordova.getActivity());
        return parser.getLaunchUrl();
    }

    /**
     * Called when the activity will start interacting with the user.
     *
     * @param multitasking Flag indicating if multitasking is turned on for app
     */
    @Override
    public void onResume(boolean multitasking) {
        this.pluginDestroyed = false;
    }

    /**
     * Called when the activity is becoming visible to the user.
     */
    @Override
    public void onStart() {
        if (!didStartApp) {
            /* The application was just started. */
            didStartApp = true;
            handleAppStart();
            /* Handle ON_NEXT_RESUME and ON_NEXT_RESTART pending installations */
            InstallOptions pendingInstall = this.codePushPackageManager.getPendingInstall();
            if (pendingInstall != null && (InstallMode.ON_NEXT_RESUME.equals(pendingInstall.installMode) || InstallMode.ON_NEXT_RESTART.equals(pendingInstall.installMode))) {
                this.markUpdateAndStartTimer(pendingInstall.rollbackTimeout);
                this.codePushPackageManager.clearPendingInstall();
            }
        } else {
            /* The application was resumed from the background. */
            /* Handle ON_NEXT_RESUME pending installations. */
            InstallOptions pendingInstall = this.codePushPackageManager.getPendingInstall();
            if ((pendingInstall != null) && (InstallMode.ON_NEXT_RESUME.equals(pendingInstall.installMode))) {
                handleAppStart();
                this.markUpdateAndStartTimer(pendingInstall.rollbackTimeout);
                this.codePushPackageManager.clearPendingInstall();
            }
        }
    }

    /**
     * The final call you receive before your activity is destroyed.
     */
    @Override
    public void onDestroy() {
        this.pluginDestroyed = true;
    }

    @Override
    public Object onMessage(String id, Object data) {
        if ("onPageFinished".equals(id)) {
            if (CodePush.ShouldClearHistoryOnLoad) {
                CodePush.ShouldClearHistoryOnLoad = false;
                if (this.mainWebView != null) {
                    this.mainWebView.clearHistory();
                }
            }
        }

        return null;
    }
}

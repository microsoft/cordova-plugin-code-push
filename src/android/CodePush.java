package com.microsoft.cordova;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.CountDownTimer;
import android.util.Log;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.ConfigXmlParser;
import org.apache.cordova.CordovaArgs;
import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CordovaWebView;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.net.MalformedURLException;
import java.util.HashSet;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

public class CodePush extends CordovaPlugin {

    public static final String CODEPUSH_OLD_PACKAGE_PATH = "/codepush/oldPackage.json";
    public static final String CODEPUSH_CURRENT_PACKAGE_PATH = "/codepush/currentPackage.json";
    public static final String RESOURCES_BUNDLE = "resources.arsc";
    private static final String WWW_ASSET_PATH_PREFIX = "file:///android_asset/www/";
    private static final String FAILED_UPDATES_PREFERENCE = "FAILED_UPDATES";
    private static final String FAILED_UPDATES_KEY = "FAILED_UPDATES_KEY";

    private CordovaWebView mainWebView;
    private boolean pluginDestroyed = false;
    private boolean didUpdate = false;
    private static boolean ApplySucceeded = false;
    private static boolean ShouldClearHistoryOnLoad = false;


    @Override
    public void initialize(CordovaInterface cordova, CordovaWebView webView) {
        super.initialize(cordova, webView);
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
        } else if ("preApply".equals(action)) {
            return execPreApply(args, callbackContext);
        } else if ("apply".equals(action)) {
            return execApply(args, callbackContext);
        } else if ("updateSuccess".equals(action)) {
            this.ApplySucceeded = true;
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
            CodePushPackageMetadata currentPackageMetadata = getCurrentPackageMetadata();
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
            boolean isFailedUpdate = this.isFailedUpdate(packageHash);
            callbackContext.success(isFailedUpdate ? 1 : 0);
        } catch (JSONException e) {
            callbackContext.error("Could not read the package hash: " + e.getMessage());
        }
        return true;
    }

    private boolean execApply(CordovaArgs args, CallbackContext callbackContext) {
        try {
            final String startLocation = args.getString(0);
            final int updateSuccessTimeoutInMillis = args.optInt(1);

            File startPage = this.getStartPageForPackage(startLocation);
            if (startPage != null) {
                /* start page file exists */
                /* navigate to the start page */
                this.navigateToFile(startPage);
                /* this flag will clear when reloading the plugin or after a didUpdate call from the JS layer */
                this.didUpdate = true;

                if (updateSuccessTimeoutInMillis > 0) {
                /* start countdown for success */
                    CodePush.ApplySucceeded = false;
                    final CountDownTimer successTimer = new CountDownTimer(updateSuccessTimeoutInMillis, updateSuccessTimeoutInMillis) {
                        @Override
                        public void onTick(long millisUntilFinished) {
                        /* empty - we are not interested in progress updates */
                        }

                        @Override
                        public void onFinish() {
                            onSuccessTimerFinish();
                        }
                    };
                    successTimer.start();
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

    private boolean execPreApply(CordovaArgs args, CallbackContext callbackContext) {
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
            String appVersionName = this.getAppVersionName();
            callbackContext.success(appVersionName);
        } catch (PackageManager.NameNotFoundException e) {
            callbackContext.error("Cannot get application version.");
        }
        return true;
    }

    private boolean execGetNativeBuildTime(CallbackContext callbackContext) {
        long millis = this.getApkEntryBuildTime(RESOURCES_BUNDLE);
        if (millis == -1) {
            callbackContext.error("Could not get the application buildstamp.");
        } else {
            String result = String.valueOf(millis);
            callbackContext.success(result);
        }
        return true;
    }

    private void onSuccessTimerFinish() {
        if (!CodePush.ApplySucceeded) {
            /* revert application to the previous version */
            this.revertToPreviousVersion();
            String url;
            try {
                CodePushPackageMetadata currentPackageMetadata = this.getCurrentPackageMetadata();
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
            try {
                this.cleanOldPackage();
            } catch (Exception e) {
                    /* silently fail if there was an error during cleanup */
                this.logException(e);
            }
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

    private String getAppVersionName() throws PackageManager.NameNotFoundException {
        Context context = cordova.getActivity();
        String currentPackageName = context.getPackageName();
        PackageInfo packageInfo = context.getPackageManager().getPackageInfo(currentPackageName, 0);
        return packageInfo.versionName;
    }

    private long getApkEntryBuildTime(String entryName) {
        ZipFile applicationFile;
        long result = -1;

        try {
            Context context = this.cordova.getActivity();
            ApplicationInfo ai = context.getPackageManager().getApplicationInfo(context.getPackageName(), 0);
            applicationFile = new ZipFile(ai.sourceDir);
            ZipEntry classesDexEntry = applicationFile.getEntry(entryName);
            result = classesDexEntry.getTime();
            applicationFile.close();
        } catch (Exception e) {
            /* empty, will return -1 */
        }

        return result;
    }

    private void revertToPreviousVersion() {
        /* delete the failed update package */
        CodePushPackageMetadata failedUpdateMetadata = this.getCurrentPackageMetadata();
        if (failedUpdateMetadata != null && failedUpdateMetadata.packageHash != null) {
            this.saveFailedUpdate(failedUpdateMetadata.packageHash);
        }
        File failedUpdateDir = new File(this.cordova.getActivity().getFilesDir() + failedUpdateMetadata.localPath);
        if (failedUpdateDir.exists()) {
            this.deleteEntryRecursively(failedUpdateDir);
        }

        /* replace the current file with the old one */
        File currentFile = new File(this.cordova.getActivity().getFilesDir() + CodePush.CODEPUSH_CURRENT_PACKAGE_PATH);
        File oldFile = new File(this.cordova.getActivity().getFilesDir() + CodePush.CODEPUSH_OLD_PACKAGE_PATH);

        if (currentFile.exists()) {
            currentFile.delete();
        }

        if (oldFile.exists()) {
            oldFile.renameTo(currentFile);
        }
    }

    private void cleanDeployments() {
        File file = new File(this.cordova.getActivity().getFilesDir() + "/codepush");
        if (file.exists()) {
            this.deleteEntryRecursively(file);
        }
    }

    private void cleanOldPackage() throws IOException, JSONException {
        CodePushPackageMetadata oldPackageMetadata = this.getOldPackageMetadata();
        if (oldPackageMetadata != null) {
            File file = new File(this.cordova.getActivity().getFilesDir() + oldPackageMetadata.localPath);
            if (file.exists()) {
                this.deleteEntryRecursively(file);
            }
        }
    }

    private void deleteEntryRecursively(File entry) {
        if (entry.isDirectory()) {
            /* delete contents first */
            for (File child : entry.listFiles()) {
                this.deleteEntryRecursively(child);
            }
        }

        entry.delete();
    }

    private void handleAppStart() {
        try {
            /* check if we have a deployed package already */
            CodePushPackageMetadata deployedPackageMetadata = getCurrentPackageMetadata();
            if (deployedPackageMetadata != null) {
                String deployedPackageTimeStamp = deployedPackageMetadata.nativeBuildTime;
                long nativeBuildTime = this.getApkEntryBuildTime(RESOURCES_BUNDLE);
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
                            this.cleanDeployments();
                            this.clearFailedUpdates();
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

    private CodePushPackageMetadata getOldPackageMetadata() {
        String currentPackageFilePath = this.cordova.getActivity().getFilesDir() + CODEPUSH_OLD_PACKAGE_PATH;
        return getPackageMetadata(currentPackageFilePath);
    }

    private CodePushPackageMetadata getCurrentPackageMetadata() {
        String currentPackageFilePath = this.cordova.getActivity().getFilesDir() + CODEPUSH_CURRENT_PACKAGE_PATH;
        return getPackageMetadata(currentPackageFilePath);
    }

    private CodePushPackageMetadata getPackageMetadata(String filePath) {
        CodePushPackageMetadata result = null;

        try {
            File file = new File(filePath);
            if (file.exists()) {
                String content = readFileContents(file);
                result = new CodePushPackageMetadata();
                JSONObject jsonObject = new JSONObject(content);

                if (jsonObject.has(CodePushPackageMetadata.JsonField.DeploymentKey)) {
                    result.deploymentKey = jsonObject.getString(CodePushPackageMetadata.JsonField.DeploymentKey);
                }

                if (jsonObject.has(CodePushPackageMetadata.JsonField.Description)) {
                    result.packageDescription = jsonObject.getString(CodePushPackageMetadata.JsonField.Description);
                }

                if (jsonObject.has(CodePushPackageMetadata.JsonField.Label)) {
                    result.label = jsonObject.getString(CodePushPackageMetadata.JsonField.Label);
                }

                if (jsonObject.has(CodePushPackageMetadata.JsonField.AppVersion)) {
                    result.appVersion = jsonObject.getString(CodePushPackageMetadata.JsonField.AppVersion);
                }

                if (jsonObject.has(CodePushPackageMetadata.JsonField.IsMandatory)) {
                    result.isMandatory = jsonObject.getBoolean(CodePushPackageMetadata.JsonField.IsMandatory);
                }

                if (jsonObject.has(CodePushPackageMetadata.JsonField.PackageHash)) {
                    result.packageHash = jsonObject.getString(CodePushPackageMetadata.JsonField.PackageHash);
                }

                if (jsonObject.has(CodePushPackageMetadata.JsonField.PackageSize)) {
                    result.packageSize = jsonObject.getLong(CodePushPackageMetadata.JsonField.PackageSize);
                }

                if (jsonObject.has(CodePushPackageMetadata.JsonField.NativeBuildTime)) {
                    result.nativeBuildTime = jsonObject.getString(CodePushPackageMetadata.JsonField.NativeBuildTime);
                }

                if (jsonObject.has(CodePushPackageMetadata.JsonField.LocalPath)) {
                    result.localPath = jsonObject.getString(CodePushPackageMetadata.JsonField.LocalPath);
                }
            }
        } catch (Exception e) {
            logException(e);
        }

        return result;
    }

    private String readFileContents(File file) throws IOException {
        StringBuilder sb = new StringBuilder();
        BufferedReader br = null;
        try {
            br = new BufferedReader(new FileReader(file));
            String currentLine;

            while ((currentLine = br.readLine()) != null) {
                sb.append(currentLine);
                sb.append('\n');
            }
        } finally {
            if (br != null) {
                br.close();
            }
        }

        return sb.toString();
    }

    private void logException(Throwable e) {
        Log.e(CodePush.class.getName(), "An error ocurred. " + e.getMessage(), e);
    }

    private void saveFailedUpdate(String hashCode) {
        SharedPreferences preferences = cordova.getActivity().getSharedPreferences(CodePush.FAILED_UPDATES_PREFERENCE, Context.MODE_PRIVATE);
        Set<String> failedUpdatesSet = preferences.getStringSet(CodePush.FAILED_UPDATES_KEY, null);
        if (failedUpdatesSet == null) {
            failedUpdatesSet = new HashSet<String>();
        }

        failedUpdatesSet.add(hashCode);
        SharedPreferences.Editor editor = preferences.edit();
        editor.putStringSet(CodePush.FAILED_UPDATES_KEY, failedUpdatesSet);
        editor.commit();
    }

    private boolean isFailedUpdate(String hashCode) {
        if (hashCode == null) {
            return false;
        }

        SharedPreferences preferences = cordova.getActivity().getSharedPreferences(CodePush.FAILED_UPDATES_PREFERENCE, Context.MODE_PRIVATE);
        Set<String> failedUpdatesSet = preferences.getStringSet(CodePush.FAILED_UPDATES_KEY, null);
        return (failedUpdatesSet != null && failedUpdatesSet.contains(hashCode));
    }

    private void clearFailedUpdates() {
        SharedPreferences preferences = cordova.getActivity().getSharedPreferences(CodePush.FAILED_UPDATES_PREFERENCE, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = preferences.edit();
        editor.clear();
        editor.commit();
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
        handleAppStart();
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

    /**
     * Model class for the CodePush metadata stored alongside a package deployment.
     */
    private static class CodePushPackageMetadata {
        public String deploymentKey;
        public String packageDescription;
        public String label;
        public String appVersion;
        public boolean isMandatory;
        public String packageHash;
        public long packageSize;
        public String nativeBuildTime;
        public String localPath;

        final static class JsonField {
            public static final String DeploymentKey = "deploymentKey";
            public static final String Description = "description";
            public static final String Label = "label";
            public static final String AppVersion = "appVersion";
            public static final String IsMandatory = "isMandatory";
            public static final String PackageHash = "packageHash";
            public static final String PackageSize = "packageSize";
            public static final String NativeBuildTime = "nativeBuildTime";
            public static final String LocalPath = "localPath";
        }
    }
}

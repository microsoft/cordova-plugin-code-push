package com.microsoft.cordova;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.content.res.Resources;
import android.util.Log;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static java.lang.Long.parseLong;

/**
 * Utilities class used for file and other common native operations.
 */
public class Utilities {
    private static final String ASSETS_MANIFEST_FILENAME = "cdvasset.manifest";

    public static String readFileContents(File file) throws IOException {
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

    public static void deleteEntryRecursively(File entry) {
        if (entry.isDirectory()) {
            /* delete contents first */
            for (File child : entry.listFiles()) {
                Utilities.deleteEntryRecursively(child);
            }
        }

        entry.delete();
    }

    public static String getAppVersionName(Context context) throws PackageManager.NameNotFoundException {
        String currentPackageName = context.getPackageName();
        PackageInfo packageInfo = context.getPackageManager().getPackageInfo(currentPackageName, 0);
        return packageInfo.versionName;
    }

    public static long getApkBuildTime(Context context) {

        Long millis;

        try {
            //replace double quotes needed for correct restoration of long value from strings.xml
            //https://github.com/Microsoft/cordova-plugin-code-push/issues/264
            millis = parseLong(context.getString(
                context.getResources().getIdentifier("CODE_PUSH_APK_BUILD_TIME", "string", context.getPackageName())
            ).replaceAll("\"",""));
        } catch(Resources.NotFoundException e) {
            return -1;
        }

        return millis;
    }

    public static void logException(Throwable e) {
        Log.e(CodePush.class.getName(), "An error occured. " + e.getMessage(), e);
    }

    public static void logMessage(String message) {
        Log.e(CodePush.class.getName(), message);
    }


    /**
     * Getting the full path to all the assets in a given asset path.
     * Note: implementation is cased on cdvasset.manifest which is generated during build time
     * @param assetManager a reference to the android's asset manager
     * @param path the asset path for which we want the asset list, if null is passed it will take all the asset from the root
     * @param ignoredFiles the files to be ignored when generating the list, if null is passed it will not ignore any files
     * @return list of paths to all the assets for a given path in the following format: path/to/asset/asset_name.xxx
     */
    public static String[] getAssetsList(AssetManager assetManager, String path, Set<String> ignoredFiles) throws IOException, ClassNotFoundException {
        ObjectInputStream ois = null;
        List<String> flatAssetPaths = new ArrayList<String>();
        try {
            ois = new ObjectInputStream(assetManager.open(ASSETS_MANIFEST_FILENAME));
            Map<String, String[]> directoryList = (Map<String, String[]>) ois.readObject();

            for(String directoryKey: directoryList.keySet()){
                if(!directoryKey.startsWith(path)){
                    continue; //skip all the assets that are not in the path
                }
                String[] directoryContent = directoryList.get(directoryKey);
                for(String item : directoryContent){
                    String absolutePath = directoryKey + "/" + item;
                    // check if the item is an asset, if it is not an asset it should be present as a key in the directory list
                    if(!directoryList.containsKey(absolutePath) && ( ignoredFiles == null || !ignoredFiles.contains(item))) {
                        flatAssetPaths.add(absolutePath);
                    }
                }
            }

            return flatAssetPaths.toArray(new String[]{});
        } finally {
            if (ois != null) {
                ois.close();
            }
        }
    }
}

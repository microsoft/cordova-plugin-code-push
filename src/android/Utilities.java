package com.microsoft.cordova;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.Resources;
import android.util.Log;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;

import static java.lang.Long.parseLong;

/**
 * Utilities class used for file and other common native operations.
 */
public class Utilities {
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
            millis = parseLong(context.getString(
                context.getResources().getIdentifier("CODE_PUSH_APK_BUILD_TIME", "string", context.getPackageName())
            ));
        } catch(Resources.NotFoundException e) {
            return -1;
        }

        return millis;
    }

    public static void logException(Throwable e) {
        Log.e(CodePush.class.getName(), "An error occured. " + e.getMessage(), e);
    }
}

package com.microsoft.cordova;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.util.Log;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

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

    public static long getApkEntryBuildTime(String entryName, Context context) {
        ZipFile applicationFile;
        long result = -1;

        try {
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

    public static void logException(Throwable e) {
        Log.e(CodePush.class.getName(), "An error occured. " + e.getMessage(), e);
    }
}

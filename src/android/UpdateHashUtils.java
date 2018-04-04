package com.microsoft.cordova;

import android.app.Activity;
import android.content.res.AssetManager;

import org.json.JSONArray;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * Utilities class used for native operations related to calculating hashes of update contents.
 */
public class UpdateHashUtils {
    private static final Set<String> ignoredFiles = new HashSet<String>(Arrays.asList(
            ".codepushrelease",
            ".DS_Store",
            "__MACOSX"
    ));

    public static String getBinaryHash(Activity activity) throws IOException, NoSuchAlgorithmException, ClassNotFoundException {
        return getHashForPath(activity, null);
    }

    public static String getHashForPath(Activity activity, String path) throws IOException, NoSuchAlgorithmException, ClassNotFoundException {
        ArrayList<String> manifestEntries = new ArrayList<String>();
        if (path == null) {
            addFolderEntriesToManifestFromAssets(manifestEntries, activity.getAssets(), "www");
        } else {
            File basePath = activity.getApplicationContext().getFilesDir();
            File fullPath = new File(basePath, path);
            addFolderEntriesToManifest(manifestEntries, "www", fullPath.getPath());
        }
        Collections.sort(manifestEntries);
        JSONArray manifestJSONArray = new JSONArray();
        for (String manifestEntry : manifestEntries) {
            manifestJSONArray.put(manifestEntry);
        }

        // The JSON serialization turns path separators into "\/", e.g. "www\/images\/image.png"
        String manifestString = manifestJSONArray.toString().replace("\\/", "/");
        return computeHash(new ByteArrayInputStream(manifestString.getBytes()));
    }

    private static void addFolderEntriesToManifestFromAssets(ArrayList<String> manifestEntries, AssetManager assetManager, String path) throws IOException, NoSuchAlgorithmException, ClassNotFoundException {
        String[] assetsList = Utilities.getAssetsList(assetManager, path, ignoredFiles);

        for(String assetPath : assetsList){
            try {
                InputStream inputStream = assetManager.open(assetPath);
                manifestEntries.add(assetPath + ":" + computeHash(inputStream));
            } catch (FileNotFoundException e) {
                // ignore: AAPT ignore some file which we can't, it's OK
                // https://github.com/Microsoft/cordova-plugin-code-push/issues/374#issuecomment-376558284
            }
        }
    }

    private static void addFolderEntriesToManifest(ArrayList<String> manifestEntries, String prefix, String path) throws IOException, NoSuchAlgorithmException {
        String[] fileList = new File(path).list();

        if (fileList != null) {
            for (String pathInFolder : fileList) {
                if (UpdateHashUtils.ignoredFiles.contains(pathInFolder)) {
                    continue;
                }
                File relativePath = new File(prefix, pathInFolder);
                File absolutePath = new File(path, pathInFolder);
                if (absolutePath.isDirectory()) {
                    addFolderEntriesToManifest(manifestEntries, relativePath.getPath(), absolutePath.getPath());
                } else {
                    InputStream inputStream = new FileInputStream(absolutePath.getPath());
                    manifestEntries.add(relativePath.getPath() + ":" + computeHash(inputStream));
                }
            }
        }
    }

    private static String computeHash(InputStream dataStream) throws IOException, NoSuchAlgorithmException {
        MessageDigest messageDigest = null;
        DigestInputStream digestInputStream = null;
        try {
            messageDigest = MessageDigest.getInstance("SHA-256");
            digestInputStream = new DigestInputStream(dataStream, messageDigest);
            byte[] byteBuffer = new byte[1024 * 8];
            while (digestInputStream.read(byteBuffer) != -1);
        } finally {
            try {
                if (digestInputStream != null) digestInputStream.close();
                if (dataStream != null) dataStream.close();
            } catch (IOException e) {
                e.printStackTrace();
            }
        }

        byte[] hash = messageDigest.digest();
        return String.format("%064x", new java.math.BigInteger(1, hash));
    }

}

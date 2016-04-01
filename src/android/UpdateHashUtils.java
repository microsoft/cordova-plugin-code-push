package com.microsoft.cordova;

import android.app.Activity;
import android.content.res.AssetManager;

import org.json.JSONArray;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;

/**
 * Utilities class used for native operations related to calculating hashes of update contents.
 */
public class UpdateHashUtils {

    public static String getBinaryHash(Activity activity) throws IOException, NoSuchAlgorithmException {
        ArrayList<String> manifestEntries = new ArrayList<String>();
        addFolderEntriesToManifest(manifestEntries, "www", activity.getAssets());
        Collections.sort(manifestEntries);
        JSONArray manifestJSONArray = new JSONArray();
        for (String manifestEntry : manifestEntries) {
            manifestJSONArray.put(manifestEntry);
        }

        // The JSON serialization turns path separators into "\/", e.g. "www\/images\/image.png"
        String manifestString = manifestJSONArray.toString().replace("\\/", "/");
        return computeHash(new ByteArrayInputStream(manifestString.getBytes()));
    }

    private static void addFolderEntriesToManifest(ArrayList<String> manifestEntries, String path, AssetManager assetManager) throws IOException, NoSuchAlgorithmException {
        String[] fileList = assetManager.list(path);
        if (fileList.length > 0) {
            // This is a folder, recursively add folder entries to the manifest.
            for (String pathInFolder : fileList) {
                addFolderEntriesToManifest(manifestEntries, path + "/" + pathInFolder, assetManager);
            }
        } else {
            // This is a file, compute a hash and create a manifest entry for it.
            manifestEntries.add(path + ":" + computeHash(assetManager.open(path)));
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

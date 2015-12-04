package com.microsoft.cordova;

import org.json.JSONObject;

import java.io.File;

/**
 * Model class for the CodePush metadata stored alongside a package deployment.
 */
public class CodePushPackageMetadata {
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

    public static CodePushPackageMetadata getPackageMetadata(String filePath) {
        CodePushPackageMetadata result = null;

        try {
            File file = new File(filePath);
            if (file.exists()) {
                String content = Utilities.readFileContents(file);
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
            Utilities.logException(e);
        }

        return result;
    }
}

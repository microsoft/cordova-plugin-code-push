#import "CodePushPackageMetadata.h"

@implementation CodePushPackageMetadata

+ (CodePushPackageMetadata*)parsePackageManifest:(NSString*)content {
    if (content) {
        NSData* manifestData = [content dataUsingEncoding:NSUTF8StringEncoding];
        NSMutableDictionary *manifest = [NSJSONSerialization JSONObjectWithData:manifestData options:NSJSONReadingMutableContainers | NSJSONReadingMutableLeaves error:NULL];
        
        if (manifestData) {
            CodePushPackageMetadata* packageMetadata = [[CodePushPackageMetadata alloc] init];
            packageMetadata.deploymentKey = manifest[@"deploymentKey"];
            packageMetadata.packageDescription = manifest[@"description"];
            packageMetadata.label = manifest[@"label"];
            packageMetadata.appVersion = manifest[@"appVersion"];
            packageMetadata.isMandatory = manifest[@"isMandatory"];
            packageMetadata.packageHash = manifest[@"packageHash"];
            packageMetadata.packageSize = manifest[@"packageSize"];
            packageMetadata.nativeBuildTime = manifest[@"nativeBuildTime"];
            packageMetadata.localPath = manifest[@"localPath"];
            return packageMetadata;
        }
    }
    
    return nil;
}

@end
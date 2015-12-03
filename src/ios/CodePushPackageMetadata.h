@interface CodePushPackageMetadata : NSObject

@property NSString* deploymentKey;
@property NSString* packageDescription;
@property NSString* label;
@property NSString* appVersion;
@property bool isMandatory;
@property NSString* packageHash;
@property NSNumber* packageSize;
@property NSString* localPath;
@property NSString* nativeBuildTime;

+ (CodePushPackageMetadata*)parsePackageManifest:(NSString*)content;

@end
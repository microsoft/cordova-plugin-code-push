#import "CodePushPackageMetadata.h"
#import "InstallOptions.h"

@interface CodePushPackageManager : NSObject

+ (void)cleanOldPackage;
+ (void)revertToPreviousVersion;
+ (CodePushPackageMetadata*)getCurrentPackageMetadata;
+ (void)clearFailedUpdates;
+ (void)cleanDeployments;
+ (NSString*)getCachedBinaryHash;
+ (void)saveBinaryHash:(NSString*)binaryHash;
+ (BOOL)isFailedHash:(NSString*)packageHash;
+ (void)savePendingInstall:(InstallOptions *)installOptions;
+ (InstallOptions*)getPendingInstall;
+ (void)clearPendingInstall;
+ (void)markInstallNeedsConfirmation;
+ (BOOL)installNeedsConfirmation;
+ (void)clearInstallNeedsConfirmation;
+ (void)clearBinaryFirstRunFlag;
+ (void)markBinaryFirstRunFlag;
+ (BOOL)isBinaryFirstRun;

@end

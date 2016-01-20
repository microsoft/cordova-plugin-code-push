#import "CodePushPackageMetadata.h"
#import "InstallOptions.h"

@interface CodePushPackageManager : NSObject

+ (void)cleanOldPackage;
+ (void)revertToPreviousVersion;
+ (CodePushPackageMetadata*)getCurrentPackageMetadata;
+ (void)clearFailedUpdates;
+ (void)cleanDeployments;
+ (BOOL)isFailedHash:(NSString*)packageHash;
+ (void)savePendingInstall:(InstallOptions *)installOptions;
+ (InstallOptions*)getPendingInstall;
+ (void)clearPendingInstall;
+ (void)markInstallNeedsConfirmation;
+ (BOOL)installNeedsConfirmation;
+ (void)clearInstallNeedsConfirmation;
+ (void)markFirstRunFlag;
+ (BOOL)isFirstRun;

@end

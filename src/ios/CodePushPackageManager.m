#import "CodePushPackageManager.h"
#import "CodePushPackageMetadata.h"
#import "InstallOptions.h"

@implementation CodePushPackageManager

NSString* const BinaryHashKey = @"BINARY_HASH";
NSString* const FailedUpdatesKey = @"FAILED_UPDATES";
NSString* const PendingInstallKey = @"PENDING_INSTALL";
NSString* const NotConfirmedInstallKey = @"NOT_CONFIRMED_INSTALL";
NSString* const IsFirstRunKey = @"FIRST_RUN";
NSString* const OldPackageManifestName = @"oldPackage.json";
NSString* const CurrentPackageManifestName = @"currentPackage.json";

+(void)cleanOldPackage {
    CodePushPackageMetadata* oldMetadata = [self getOldPackageMetadata];
    
    // delete the package folder
    [self cleanPackageDirectory:oldMetadata];
    
    // delete the downloads folder
    [self cleanDownloads];
}

+(void)cleanDownloads {
    NSString* libraryLocation = [NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) objectAtIndex:0];
    NSArray* downloadFolderArray = @[libraryLocation, @"NoCloud", @"codepush", @"download"];
    NSString* downloadFolderLocation = [NSString pathWithComponents:downloadFolderArray];
    if ([[NSFileManager defaultManager] fileExistsAtPath: downloadFolderLocation]) {
        [[NSFileManager defaultManager] removeItemAtPath:downloadFolderLocation error:nil];
    }
}

+(void)cleanPackageDirectory:(CodePushPackageMetadata*)packageMetadata {
    NSString* libraryLocation = [NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) objectAtIndex:0];
    
    if (nil != packageMetadata && nil != packageMetadata.localPath) {
        // delete the package folder
        NSArray* oldPackageDir = @[libraryLocation, @"NoCloud", packageMetadata.localPath];
        NSString* oldPackageDirPath = [NSString pathWithComponents:oldPackageDir];
        if ([[NSFileManager defaultManager] fileExistsAtPath: oldPackageDirPath]) {
            [[NSFileManager defaultManager] removeItemAtPath:oldPackageDirPath error:nil];
        }
    }
}

+(void)cleanDeployments {
    // check if the file exists
    NSString* libraryLocation = [NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) objectAtIndex:0];
    NSArray* codePushDirectoryArray = @[libraryLocation, @"NoCloud", @"codepush" ];
    NSString* codePushDirPath = [NSString pathWithComponents:codePushDirectoryArray];
    if ([[NSFileManager defaultManager] fileExistsAtPath:codePushDirPath]) {
        [[NSFileManager defaultManager] removeItemAtPath:codePushDirPath error:nil];
    }
}

+ (NSString*)getCachedBinaryHash {
    NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
    NSString* cachedBinaryHash = [preferences objectForKey:BinaryHashKey];
    return cachedBinaryHash;
}

+ (void)saveBinaryHash:(NSString*)binaryHash {
    NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
    [preferences setObject:binaryHash forKey:BinaryHashKey];
    [preferences synchronize];
}

+ (CodePushPackageMetadata*)getOldPackageMetadata {
    return [self readPackageManifest:OldPackageManifestName];
}

+ (CodePushPackageMetadata*)getCurrentPackageMetadata {
    return [self readPackageManifest:CurrentPackageManifestName];
}

+ (BOOL)isFailedHash:(NSString*)packageHash {
    NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
    NSMutableArray* failedUpdates = [preferences objectForKey:FailedUpdatesKey];
    return (nil != failedUpdates && [failedUpdates containsObject:packageHash]);
}

+ (void)saveFailedUpdate:(NSString *)packageHash {
    NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
    NSMutableArray* failedUpdates = [[preferences objectForKey:FailedUpdatesKey] mutableCopy];
    if (nil == failedUpdates) {
        failedUpdates = [[NSMutableArray alloc] init];
    }
    
    [failedUpdates addObject:packageHash];
    [preferences setObject:failedUpdates forKey:FailedUpdatesKey];
    [preferences synchronize];
}

+ (void)clearFailedUpdates {
    NSUserDefaults *preferences = [NSUserDefaults standardUserDefaults];
    [preferences removeObjectForKey:FailedUpdatesKey];
}

+ (void)savePendingInstall:(InstallOptions *)installOptions {
    NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
    NSData* serializedPendingInstall = [NSKeyedArchiver archivedDataWithRootObject:installOptions];
    [preferences setObject:serializedPendingInstall forKey:PendingInstallKey];
    [preferences synchronize];
}

+ (InstallOptions*)getPendingInstall{
    NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
    NSData* serializedPendingInstall = [[preferences objectForKey:PendingInstallKey] mutableCopy];
    if (serializedPendingInstall) {
        InstallOptions* pendingInstall = [NSKeyedUnarchiver unarchiveObjectWithData:serializedPendingInstall];
        return pendingInstall;
    }
    
    return nil;
}

+ (void)clearPendingInstall {
    NSUserDefaults *preferences = [NSUserDefaults standardUserDefaults];
    [preferences removeObjectForKey:PendingInstallKey];
}

+ (void)markFirstRunFlag {
    NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
    [preferences setBool:YES forKey:IsFirstRunKey];
    [preferences synchronize];
}

+ (BOOL)isFirstRun {
    NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
    BOOL firstRunFlagSet = [preferences boolForKey:IsFirstRunKey];
    return !firstRunFlagSet;
}

+ (void)markInstallNeedsConfirmation {
    NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
    [preferences setBool:YES forKey:NotConfirmedInstallKey];
    [preferences synchronize];
}

+ (BOOL)installNeedsConfirmation {
    NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
    BOOL notConfirmedInstall = [preferences boolForKey:NotConfirmedInstallKey];
    return notConfirmedInstall;
}

+ (void)clearInstallNeedsConfirmation {
    NSUserDefaults *preferences = [NSUserDefaults standardUserDefaults];
    [preferences removeObjectForKey:NotConfirmedInstallKey];
}

+ (CodePushPackageMetadata*)readPackageManifest:(NSString*)manifestName {
    // check if the file exists
    NSString* libraryLocation = [NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) objectAtIndex:0];
    NSArray* manifestLocationArray = @[libraryLocation, @"NoCloud", @"codepush", manifestName];
    NSString* manifestLocation = [NSString pathWithComponents:manifestLocationArray];
    if ([[NSFileManager defaultManager] fileExistsAtPath:manifestLocation]) {
        // read the package manifest
        NSString* content = [NSString stringWithContentsOfFile:manifestLocation encoding:NSUTF8StringEncoding  error:NULL];
        if (content != nil) {
            // parse the content
            return [CodePushPackageMetadata parsePackageManifest:content];
        }
    }
    
    return nil;
    
}

+ (void)revertToPreviousVersion {
    /* clean the current package */
    CodePushPackageMetadata* failedMetadata = [self getCurrentPackageMetadata];
    if (nil != failedMetadata.packageHash) {
        [self saveFailedUpdate:failedMetadata.packageHash];
    }
    [self cleanPackageDirectory:failedMetadata];
    
    /* replace the current metadata file with the old one */
    NSString* libraryLocation = [NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) objectAtIndex:0];
    NSArray* oldManifestArray = @[libraryLocation, @"NoCloud", @"codepush", OldPackageManifestName];
    NSArray* currentManifestArray = @[libraryLocation, @"NoCloud", @"codepush", CurrentPackageManifestName];
    
    NSString* oldManifestLocation = [NSString pathWithComponents:oldManifestArray];
    NSString* currentManifestLocation = [NSString pathWithComponents:currentManifestArray];
    
    if ([[NSFileManager defaultManager] fileExistsAtPath:currentManifestLocation]) {
        [[NSFileManager defaultManager] removeItemAtPath:currentManifestLocation error:nil];
    }
    
    /* move the old manifest to the curent location */
    if ([[NSFileManager defaultManager] fileExistsAtPath:oldManifestLocation]) {
        [[NSFileManager defaultManager] moveItemAtPath:oldManifestLocation toPath:currentManifestLocation error:nil];
    }
    
    [self cleanDownloads];
}

@end
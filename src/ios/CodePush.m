#import <Cordova/CDV.h>
#import <Cordova/CDVConfigParser.h>
#import "CodePush.h"

@implementation CodePush

bool updateSuccess = false;
bool didUpdate = false;
NSString* const FailedUpdatesKey = @"FAILED_UPDATES";
NSString* const OldPackageManifestName = @"oldPackage.json";
NSString* const CurrentPackageManifestName = @"currentPackage.json";

- (void)onUpdateSuccessTimeout {
    if (!updateSuccess) {
        [self revertToPreviousVersion];
        CodePushPackageMetadata* currentMetadata = [self getCurrentPackageMetadata];
        bool revertSuccess = (nil != currentMetadata && [self loadPackage:currentMetadata.localPath]);
        if (!revertSuccess) {
            /* first update failed, go back to store version by reloading the controller */
            [((CDVViewController *)self.viewController) viewDidLoad];
            [((CDVViewController *)self.viewController) viewWillAppear:YES];
        }
    }
    else {
        /* update success, delete the old package */
        [self cleanOldPackage];
    }
}

- (void)updateSuccess:(CDVInvokedUrlCommand *)command {
    updateSuccess = YES;
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)apply:(CDVInvokedUrlCommand *)command {
    CDVPluginResult* pluginResult = nil;
    
    NSString* location = [command argumentAtIndex:0 withDefault:nil andClass:[NSString class]];
    if (nil == location) {
        pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Cannot read the start URL."];
    }
    else {
        bool applied = [self loadPackage: location];
        if (applied ) {
            didUpdate = YES;
            NSString* successTimeoutMillisString = [command argumentAtIndex:1 withDefault:nil andClass:[NSString class]];
            if (successTimeoutMillisString) {
                /* Start the revert timer */
                int successTimeoutMillis = [successTimeoutMillisString intValue];
                if (successTimeoutMillis > 0) {
                    updateSuccess = NO;
                    NSTimeInterval successTimeoutInterval = successTimeoutMillis / 1000;
                    [NSTimer scheduledTimerWithTimeInterval:successTimeoutInterval target:self selector:@selector(onUpdateSuccessTimeout) userInfo:nil repeats:NO];
                }
            }
            
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
        }
        else {
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"An error happened during package apply."];
        }
    }
    
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)preApply:(CDVInvokedUrlCommand *)command {
    CDVPluginResult* pluginResult = nil;
    
    NSString* location = [command argumentAtIndex:0 withDefault:nil andClass:[NSString class]];
    if (nil == location) {
        pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Cannot read the start URL."];
    }
    else {
        NSURL* URL = [self getStartPageURLForLocalPackage:location];
        if (URL) {
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
        }
        else {
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Could not find start page in package."];
        }
    }
    
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)getServerURL:(CDVInvokedUrlCommand *)command {
    [self sendResultForPreference:@"codepushserverurl" command:command];
}

- (void)getDeploymentKey:(CDVInvokedUrlCommand *)command {
    [self sendResultForPreference:@"codepushdeploymentkey" command:command];
}


- (void)getNativeBuildTime:(CDVInvokedUrlCommand *)command {
    NSString* timeStamp = [self getApplicationTimestamp];
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:timeStamp];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)sendResultForPreference:(NSString*)preferenceName command:(CDVInvokedUrlCommand*)command {
    NSString* preferenceValue = ((CDVViewController *)self.viewController).settings[preferenceName];
    // length of NIL is zero
    CDVPluginResult* pluginResult;
    if ([preferenceValue length] > 0) {
        pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:preferenceValue];
    } else {
        pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:[NSString stringWithFormat:@"Could not find preference %@", preferenceName]];
    }
    
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)pluginInitialize {
    // check if we have a deployed package
    CodePushPackageMetadata* deployedPackageMetadata = [self getCurrentPackageMetadata];
    if (deployedPackageMetadata) {
        NSString* deployedPackageNativeBuildTime = deployedPackageMetadata.nativeBuildTime;
        NSString* applicationBuildTime = [self getApplicationTimestamp];
        
        if (deployedPackageNativeBuildTime != nil && applicationBuildTime != nil) {
            if ([deployedPackageNativeBuildTime isEqualToString: applicationBuildTime] ) {
                // same version, safe to launch from local storage
                if (deployedPackageMetadata.localPath) {
                    [self redirectStartPageToURL: deployedPackageMetadata.localPath];
                }
            }
            else {
                // installed native version is different from package version => clean up deployed package and do not modify start page
                [self cleanDeployments];
                [self clearFailedUpdates];
            }
        }
    }
}

-(void)revertToPreviousVersion {
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

-(void)cleanOldPackage {
    CodePushPackageMetadata* oldMetadata = [self getOldPackageMetadata];
    
    // delete the package folder
    [self cleanPackageDirectory:oldMetadata];
    
    // delete the downloads folder
    [self cleanDownloads];
}

-(void)cleanDownloads {
    NSString* libraryLocation = [NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) objectAtIndex:0];
    NSArray* downloadFolderArray = @[libraryLocation, @"NoCloud", @"codepush", @"download"];
    NSString* downloadFolderLocation = [NSString pathWithComponents:downloadFolderArray];
    if ([[NSFileManager defaultManager] fileExistsAtPath: downloadFolderLocation]) {
        [[NSFileManager defaultManager] removeItemAtPath:downloadFolderLocation error:nil];
    }
}

-(void)cleanPackageDirectory:(CodePushPackageMetadata*)packageMetadata {
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

-(void)cleanDeployments {
    // check if the file exists
    NSString* libraryLocation = [NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) objectAtIndex:0];
    NSArray* codePushDirectoryArray = @[libraryLocation, @"NoCloud", @"codepush" ];
    NSString* codePushDirPath = [NSString pathWithComponents:codePushDirectoryArray];
    if ([[NSFileManager defaultManager] fileExistsAtPath:codePushDirPath]) {
        [[NSFileManager defaultManager] removeItemAtPath:codePushDirPath error:nil];
    }
}

- (BOOL)loadPackage:(NSString*)packageLocation {
    NSURL* URL = [self getStartPageURLForLocalPackage:packageLocation];
    if (URL) {
        [((CDVViewController *)self.viewController).webView loadRequest:[NSURLRequest requestWithURL:URL]];
        return YES;
    }
    
    return NO;
}

- (NSURL *)getStartPageURLForLocalPackage:(NSString*)packageLocation {
    if (packageLocation) {
        NSString* startPage = [self getConfigLaunchUrl];
        NSString* libraryLocation = [NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) objectAtIndex:0];
        NSArray* realLocationArray = @[libraryLocation, @"NoCloud", packageLocation, @"www", startPage];
        NSString* realStartPageLocation = [NSString pathWithComponents:realLocationArray];
        if ([[NSFileManager defaultManager] fileExistsAtPath:realStartPageLocation]) {
            return [NSURL fileURLWithPath:realStartPageLocation];
        }
    }
    
    return nil;
}

- (NSString*)getConfigLaunchUrl
{
    CDVConfigParser* delegate = [[CDVConfigParser alloc] init];
    NSString* configPath = [[NSBundle mainBundle] pathForResource:@"config" ofType:@"xml"];
    NSURL* configUrl = [NSURL fileURLWithPath:configPath];
    
    NSXMLParser* configParser = [[NSXMLParser alloc] initWithContentsOfURL:configUrl];
    [configParser setDelegate:((id < NSXMLParserDelegate >)delegate)];
    [configParser parse];
    
    return delegate.startPage;
}

- (void)redirectStartPageToURL:(NSString*)packageLocation{
    NSURL* URL = [self getStartPageURLForLocalPackage:packageLocation];
    if (URL) {
        ((CDVViewController *)self.viewController).startPage = [URL absoluteString];
    }
}

- (NSString*)getApplicationTimestamp{
    NSDate* applicationBuildTime = [self getApplicationBuildTime];
    if (applicationBuildTime){
        NSNumber* timestamp = [[NSNumber alloc] initWithDouble: floor([applicationBuildTime timeIntervalSince1970] * 1000)];
        return [timestamp stringValue];
    }
    
    return nil;
}

- (NSDate*)getApplicationBuildTime{
    NSString *appPath = [[NSBundle mainBundle] bundlePath];
    NSDictionary *executableAttributes = [[NSFileManager defaultManager] attributesOfItemAtPath:appPath error:nil];
    return [executableAttributes objectForKey:@"NSFileModificationDate"];
}

- (void)getAppVersion:(CDVInvokedUrlCommand *)command {
    NSString* version = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:version];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)isFailedUpdate:(CDVInvokedUrlCommand *)command {
    CDVPluginResult* result;
    NSString* packageHash = [command argumentAtIndex:0 withDefault:nil andClass:[NSString class]];
    if (nil == packageHash) {
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Invalid package hash parameter."];
    }
    else {
        BOOL failedHash = [self isFailedHash:packageHash];
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsInt:failedHash ? 1 : 0];
    }
    
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

- (void)isFirstRun:(CDVInvokedUrlCommand *)command {
    CDVPluginResult* result;
    BOOL isFirstRun = NO;
    
    NSString* packageHash = [command argumentAtIndex:0 withDefault:nil andClass:[NSString class]];
    CodePushPackageMetadata* currentPackageMetadata = [self getCurrentPackageMetadata];
    if (currentPackageMetadata) {
        isFirstRun = (nil != packageHash
                      && [packageHash length] > 0
                      && [packageHash isEqualToString:currentPackageMetadata.packageHash]
                      && didUpdate);
    }
    
    result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsInt:isFirstRun ? 1 : 0];
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

- (BOOL)isFailedHash:(NSString*)packageHash {
    NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
    NSMutableArray* failedUpdates = [preferences objectForKey:FailedUpdatesKey];
    return (nil != failedUpdates && [failedUpdates containsObject:packageHash]);
}

- (void)saveFailedUpdate:(NSString *)packageHash {
    NSUserDefaults *preferences = [NSUserDefaults standardUserDefaults];
    NSMutableArray* failedUpdates = [[preferences objectForKey:FailedUpdatesKey] mutableCopy];
    if (nil == failedUpdates) {
        failedUpdates = [[NSMutableArray alloc] init];
    }
    
    [failedUpdates addObject:packageHash];
    [preferences setObject:failedUpdates forKey:FailedUpdatesKey];
    [preferences synchronize];
}

- (void)clearFailedUpdates {
    NSUserDefaults *preferences = [NSUserDefaults standardUserDefaults];
    [preferences removeObjectForKey:FailedUpdatesKey];
}

- (CodePushPackageMetadata*)parsePackageManifest:(NSString*)content {
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

- (CodePushPackageMetadata*)getOldPackageMetadata {
    return [self readPackageManifest:OldPackageManifestName];
}

- (CodePushPackageMetadata*)getCurrentPackageMetadata {
    return [self readPackageManifest:CurrentPackageManifestName];
}

- (CodePushPackageMetadata*)readPackageManifest:(NSString*)manifestName {
    // check if the file exists
    NSString* libraryLocation = [NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) objectAtIndex:0];
    NSArray* manifestLocationArray = @[libraryLocation, @"NoCloud", @"codepush", manifestName];
    NSString* manifestLocation = [NSString pathWithComponents:manifestLocationArray];
    if ([[NSFileManager defaultManager] fileExistsAtPath:manifestLocation]) {
        // read the package manifest
        NSString* content = [NSString stringWithContentsOfFile:manifestLocation encoding:NSUTF8StringEncoding  error:NULL];
        if (content != nil) {
            // parse the content
            return [self parsePackageManifest:content];
        }
    }
    
    return nil;
    
}

@end

@implementation CodePushPackageMetadata
@end
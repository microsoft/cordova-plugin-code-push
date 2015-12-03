#import <Cordova/CDV.h>
#import <Cordova/CDVConfigParser.h>
#import "CodePush.h"
#import "CodePushPackageMetadata.h"
#import "CodePushPackageManager.h"
#import "Utilities.h"
#import "InstallOptions.h"
#import "InstallMode.h"

@implementation CodePush

bool updateSuccess = false;
bool didUpdate = false;
bool pendingInstall = false;

- (void)onUpdateSuccessTimeout {
    if (!updateSuccess) {
        [CodePushPackageManager revertToPreviousVersion];
        CodePushPackageMetadata* currentMetadata = [CodePushPackageManager getCurrentPackageMetadata];
        bool revertSuccess = (nil != currentMetadata && [self loadPackage:currentMetadata.localPath]);
        if (!revertSuccess) {
            /* first update failed, go back to store version */
            [self loadStoreVersion];
            
        }
    }
    else {
        /* update success, delete the old package */
        [CodePushPackageManager cleanOldPackage];
    }
}

- (void)updateSuccess:(CDVInvokedUrlCommand *)command {
    updateSuccess = YES;
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)install:(CDVInvokedUrlCommand *)command {
    CDVPluginResult* pluginResult = nil;
    
    NSString* location = [command argumentAtIndex:0 withDefault:nil andClass:[NSString class]];
    NSString* successTimeoutMillisString = [command argumentAtIndex:1 withDefault:nil andClass:[NSString class]];
    NSString* installModeString = [command argumentAtIndex:2 withDefault:nil andClass:[NSString class]];
    
    InstallOptions* options = [[InstallOptions alloc] init];
    [options setInstallMode:IMMEDIATE];
    [options setRollbackTimeout:0];
    
    if (successTimeoutMillisString) {
        [options setRollbackTimeout:[successTimeoutMillisString intValue]];
    }
    
    if (installModeString) {
        [options setInstallMode:[installModeString intValue]];
    }
    
    if ([options installMode] == IMMEDIATE) {
        if (nil == location) {
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Cannot read the start URL."];
        }
        else {
            bool applied = [self loadPackage: location];
            if (applied) {
                [self markUpdateAndStartTimer:[options rollbackTimeout]];
                pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
            }
            else {
                pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"An error happened during package install."];
            }
        }
    }
    else {
        /* install on restart or on resume */
        [CodePushPackageManager savePendingInstall:options];
        pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    }
    
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void) markUpdateAndStartTimer:(NSInteger)updateSuccessTimeoutInMillis {
    didUpdate = YES;
    if (updateSuccessTimeoutInMillis > 0) {
        updateSuccess = NO;
        NSTimeInterval successTimeoutInterval = updateSuccessTimeoutInMillis / 1000;
        [NSTimer scheduledTimerWithTimeInterval:successTimeoutInterval target:self selector:@selector(onUpdateSuccessTimeout) userInfo:nil repeats:NO];
    }
    else {
        [CodePushPackageManager cleanOldPackage];
    }
}

- (void)preInstall:(CDVInvokedUrlCommand *)command {
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
    NSString* timeStamp = [Utilities getApplicationTimestamp];
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

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)handleAppStart {
    // check if we have a deployed package
    CodePushPackageMetadata* deployedPackageMetadata = [CodePushPackageManager getCurrentPackageMetadata];
    if (deployedPackageMetadata) {
        NSString* deployedPackageNativeBuildTime = deployedPackageMetadata.nativeBuildTime;
        NSString* applicationBuildTime = [Utilities getApplicationTimestamp];
        
        if (deployedPackageNativeBuildTime != nil && applicationBuildTime != nil) {
            if ([deployedPackageNativeBuildTime isEqualToString: applicationBuildTime] ) {
                // same version, safe to launch from local storage
                if (deployedPackageMetadata.localPath) {
                    [self redirectStartPageToURL: deployedPackageMetadata.localPath];
                }
            }
            else {
                // installed native version is different from package version => clean up deployed package and do not modify start page
                [CodePushPackageManager cleanDeployments];
                [CodePushPackageManager clearFailedUpdates];
                [CodePushPackageManager clearPendingInstall];
            }
        }
    }
}

- (void)pluginInitialize {
    // register for "on resume" notifications
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(applicationWillEnterForeground) name:UIApplicationWillEnterForegroundNotification object:nil];
    
    [self handleAppStart];
    InstallOptions* pendingInstall = [CodePushPackageManager getPendingInstall];
    // handle both ON_NEXT_RESUME and ON_NEXT_RESTART - the application might have been killed after transitioning to the background
    if (pendingInstall && (pendingInstall.installMode == ON_NEXT_RESTART || pendingInstall.installMode == ON_NEXT_RESUME)) {
        [self markUpdateAndStartTimer:pendingInstall.rollbackTimeout];
        [CodePushPackageManager clearPendingInstall];
    }
}

- (void)applicationWillEnterForeground {
    InstallOptions* pendingInstall = [CodePushPackageManager getPendingInstall];
    if (pendingInstall && pendingInstall.installMode == ON_NEXT_RESUME) {
        CodePushPackageMetadata* deployedPackageMetadata = [CodePushPackageManager getCurrentPackageMetadata];
        if (deployedPackageMetadata && deployedPackageMetadata.localPath) {
            bool applied = [self loadPackage: deployedPackageMetadata.localPath];
            if (applied) {
                [self markUpdateAndStartTimer:pendingInstall.rollbackTimeout];
                [CodePushPackageManager clearPendingInstall];
            }
        }
    }
}

- (BOOL)loadPackage:(NSString*)packageLocation {
    NSURL* URL = [self getStartPageURLForLocalPackage:packageLocation];
    if (URL) {
        [self loadURL:URL];
        return YES;
    }
    
    return NO;
}

- (void)loadURL:(NSURL*)url {
    [((CDVViewController *)self.viewController).webView loadRequest:[NSURLRequest requestWithURL:url]];
}

- (void)loadStoreVersion {
    NSString* mainBundlePath = [[NSBundle mainBundle] bundlePath];
    NSString* configStartPage = [self getConfigLaunchUrl];
    NSArray* realLocationArray = @[mainBundlePath, @"www", configStartPage];
    NSString* mainPageLocation = [NSString pathWithComponents:realLocationArray];
    if ([[NSFileManager defaultManager] fileExistsAtPath:mainPageLocation]) {
        NSURL* mainPagePath = [NSURL fileURLWithPath:mainPageLocation];
        [self loadURL:mainPagePath];
    }
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

- (void)redirectStartPageToURL:(NSString*)packageLocation{
    NSURL* URL = [self getStartPageURLForLocalPackage:packageLocation];
    if (URL) {
        ((CDVViewController *)self.viewController).startPage = [URL absoluteString];
    }
}

- (void)isFailedUpdate:(CDVInvokedUrlCommand *)command {
    CDVPluginResult* result;
    NSString* packageHash = [command argumentAtIndex:0 withDefault:nil andClass:[NSString class]];
    if (nil == packageHash) {
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Invalid package hash parameter."];
    }
    else {
        BOOL failedHash = [CodePushPackageManager isFailedHash:packageHash];
        result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsInt:failedHash ? 1 : 0];
    }
    
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

- (void)isFirstRun:(CDVInvokedUrlCommand *)command {
    CDVPluginResult* result;
    BOOL isFirstRun = NO;
    
    NSString* packageHash = [command argumentAtIndex:0 withDefault:nil andClass:[NSString class]];
    CodePushPackageMetadata* currentPackageMetadata = [CodePushPackageManager getCurrentPackageMetadata];
    if (currentPackageMetadata) {
        isFirstRun = (nil != packageHash
                      && [packageHash length] > 0
                      && [packageHash isEqualToString:currentPackageMetadata.packageHash]
                      && didUpdate);
    }
    
    result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsInt:isFirstRun ? 1 : 0];
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

- (void)getAppVersion:(CDVInvokedUrlCommand *)command {
    NSString* version = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:version];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

@end


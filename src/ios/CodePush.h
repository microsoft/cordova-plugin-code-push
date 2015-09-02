#import <Cordova/CDV.h>

@interface CodePush : CDVPlugin

- (void)getServerURL:(CDVInvokedUrlCommand*)command;
- (void)getDeploymentKey:(CDVInvokedUrlCommand*)command;
- (void)getNativeBuildTime:(CDVInvokedUrlCommand*)command;
- (void)getAppVersion:(CDVInvokedUrlCommand*)command;
- (void)apply:(CDVInvokedUrlCommand *)command;
- (void)preApply:(CDVInvokedUrlCommand *)command;
- (void)isFailedUpdate:(CDVInvokedUrlCommand *)command;
- (void)isFirstRun:(CDVInvokedUrlCommand *)command;
- (void)updateSuccess:(CDVInvokedUrlCommand *)command;
- (void)pluginInitialize;

@end

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

@end
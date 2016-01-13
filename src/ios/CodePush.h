#import <Cordova/CDV.h>

@interface CodePush : CDVPlugin

- (void)getServerURL:(CDVInvokedUrlCommand*)command;
- (void)getDeploymentKey:(CDVInvokedUrlCommand*)command;
- (void)getNativeBuildTime:(CDVInvokedUrlCommand*)command;
- (void)getAppVersion:(CDVInvokedUrlCommand*)command;
- (void)install:(CDVInvokedUrlCommand *)command;
- (void)preInstall:(CDVInvokedUrlCommand *)command;
- (void)isFailedUpdate:(CDVInvokedUrlCommand *)command;
- (void)isFirstRun:(CDVInvokedUrlCommand *)command;
- (void)isPendingUpdate:(CDVInvokedUrlCommand *)command;
- (void)updateSuccess:(CDVInvokedUrlCommand *)command;
- (void)restartApplication:(CDVInvokedUrlCommand *)command;
- (void)pluginInitialize;

@end


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
- (void)restartApplication:(CDVInvokedUrlCommand *)command;
- (void)getBinaryHash:(CDVInvokedUrlCommand *)command;
- (void)getPackageHash:(CDVInvokedUrlCommand *)command;
- (void)decodeSignature:(CDVInvokedUrlCommand *)command;
- (void)getPublicKey:(CDVInvokedUrlCommand *)command;
- (void)pluginInitialize;
+ (Boolean)hasIonicWebViewEngine:(id<CDVWebViewEngineProtocol>) webViewEngine;
+ (void) setServerBasePath:(NSString*)serverPath webView:(id<CDVWebViewEngineProtocol>) webViewEngine;
+ (NSString*) getCurrentServerBasePath;

void CPLog(NSString *formatString, ...);
@end

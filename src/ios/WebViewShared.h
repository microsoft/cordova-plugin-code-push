#import <Cordova/CDVWebViewEngineProtocol.h>
#import <Cordova/CDVCommandDelegate.h>

@interface WebViewShared : NSObject

@property id<CDVCommandDelegate> commandDelegate;
@property id<CDVWebViewEngineProtocol> webViewEngine;
@property UIViewController *viewController;

+ (id)getInstanceOrCreate:(id<CDVWebViewEngineProtocol>)webViewEngine andCommandDelegate:(id<CDVCommandDelegate>)commandDelegate andViewController:(UIViewController *)viewController;
+ (NSString *)getIdentifierCodePushPath;
- (id)initWithWebViewEngine:(id<CDVWebViewEngineProtocol>)webViewEngine andCommandDelegate:(id<CDVCommandDelegate>)commandDelegate andViewController:(UIViewController *)viewController;
- (id)loadRequest:(NSURLRequest *)request;
- (id)loadIonicPluginRequest:(NSURLRequest *)request;

@end

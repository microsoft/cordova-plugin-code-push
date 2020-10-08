#import <WebKit/WebKit.h>
#import "WebViewShared.h"
#import "CodePush.h"
#import <Cordova/NSDictionary+CordovaPreferences.h>

@implementation WebViewShared

id<CDVWebViewEngineProtocol> webViewEngine;
id<CDVCommandDelegate> commandDelegate;
UIViewController* viewController;
NSString* const IdentifierCodePushPath = @"codepush/deploy/versions";

+ (id)getInstanceOrCreate:(id<CDVWebViewEngineProtocol>)webViewEngine andCommandDelegate:(id<CDVCommandDelegate>)commandDelegate andViewController:(UIViewController*)viewController {
    static WebViewShared* instance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        instance = [[self alloc] initWithWebViewEngine:webViewEngine
                              andCommandDelegate:commandDelegate
                               andViewController:viewController];
    });
    return instance;
}
    
- (id)initWithWebViewEngine:(id<CDVWebViewEngineProtocol>)webViewEngine andCommandDelegate:(id<CDVCommandDelegate>)commandDelegate andViewController:(UIViewController*)viewController {
    self = [super init];
    if (self) {
        _webViewEngine = webViewEngine;
        _commandDelegate = commandDelegate;
        _viewController = viewController;
    }
    
    return self;
}

- (id)loadRequest:(NSURLRequest *)request {
    NSString* lastLoadedURL = request.URL.absoluteString;
    NSURL *readAccessURL;

    NSURL* bundleURL = [[NSBundle mainBundle] bundleURL];
    if (![lastLoadedURL containsString:bundleURL.path] && ![lastLoadedURL containsString:IdentifierCodePushPath]) {
        // Happens only for Ionic apps
        return [self loadIonicPluginRequest: request];
    }

    if (request.URL.isFileURL) {
        // All file URL requests should be handled with the setServerBasePath in case if it is Ionic app.
        if ([CodePush hasIonicWebViewEngine: self.webViewEngine]) {
            NSString* specifiedServerPath = [CodePush getCurrentServerBasePath];
            if (![specifiedServerPath containsString:IdentifierCodePushPath] || [request.URL.path containsString:IdentifierCodePushPath]) {
                [CodePush setServerBasePath:request.URL.path webView: self.webViewEngine];
            }

            return nil;
        }

        if ([request.URL.absoluteString containsString:IdentifierCodePushPath]) {
            // If the app is attempting to load a CodePush update, then we can lock the WebView down to
            // just the CodePush "versions" directory. This prevents non-CodePush assets from being accessible,
            // while still allowing us to navigate to a future update, as well as to the binary if a rollback is needed.
            NSString *libraryPath = NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES)[0];
            readAccessURL = [NSURL fileURLWithPathComponents:@[libraryPath, @"NoCloud", @"codepush", @"deploy", @"versions"]];
        } else {
            // In order to allow the WebView to be navigated from the app bundle to another location, we (for some
            // entirely unknown reason) need to ensure that the "read access URL" is set to the parent of the bundle
            // as opposed to the www folder, which is what the WKWebViewEngine would attempt to set it to by default.
            // If we didn't set this, then the attempt to navigate from the bundle to a CodePush update would fail.
            readAccessURL = [[[NSBundle mainBundle] bundleURL] URLByDeletingLastPathComponent];
        }

        return [(WKWebView*)self.webViewEngine loadFileURL:request.URL allowingReadAccessToURL:readAccessURL];
    } else {
        return [(WKWebView*)self.webViewEngine loadRequest: request];
    }
}

- (id)loadIonicPluginRequest:(NSURLRequest *)request {
    if (request.URL.fileURL) {
        NSDictionary* settings = self.commandDelegate.settings;
        NSString *bind = [settings cordovaSettingForKey:@"Hostname"];
        if(bind == nil){
            bind = @"localhost";
        }
        NSString *scheme = [settings cordovaSettingForKey:@"iosScheme"];
        if(scheme == nil || [scheme isEqualToString:@"http"] || [scheme isEqualToString:@"https"]  || [scheme isEqualToString:@"file"]){
            scheme = @"ionic";
        }
        NSString *CDV_LOCAL_SERVER = [NSString stringWithFormat:@"%@://%@", scheme, bind];
        
        NSURL* startURL = [NSURL URLWithString:((CDVViewController *)self.viewController).startPage];
        NSString* startFilePath = [self.commandDelegate pathForResource:[startURL path]];
        NSURL *url = [[NSURL URLWithString:CDV_LOCAL_SERVER] URLByAppendingPathComponent:request.URL.path];
        if ([request.URL.path isEqualToString:startFilePath]) {
            url = [NSURL URLWithString:CDV_LOCAL_SERVER];
        }
        if(request.URL.query) {
            url = [NSURL URLWithString:[@"?" stringByAppendingString:request.URL.query] relativeToURL:url];
        }
        if(request.URL.fragment) {
            url = [NSURL URLWithString:[@"#" stringByAppendingString:request.URL.fragment] relativeToURL:url];
        }
        request = [NSURLRequest requestWithURL:url];
    }
    return [(WKWebView*)self.webViewEngine loadRequest:request];
}

@end

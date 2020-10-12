#import <Cordova/CDVViewController.h>
#import <objc/runtime.h>
#import "WebViewShared.h"
#import "Utilities.h"

@interface CDVViewController (CodePush)
- (NSURL*)appUrl; // Expose private method from original CDVViewController
@end

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wincomplete-implementation"

@implementation CDVViewController (CodePush)

#pragma clang diagnostic pop

- (void)viewDidLoad_codepush
{
    // Calls original viewDidLoad method from CDVViewController
    [self viewDidLoad_codepush];
    
    /*
     In original viewDid method from CDVViewController at the end it tries to open start page using something like self.webViewEngine loadRequest [self appUrl].
     [self appUrl] is only resolves full path for startPage.
     For example
     
     // CDVViewController.m
     ...
     // self.startPage is set somewhere to @"index.html";
     
     - (void)viewDidLoad {
        ...
         NSURL* url = [self appUrl]; //manipulates with self.startPage
         //url is now @"file://HOSTNAME/path/to/index.html"
     }
     
     It leads to WKWebView unable to load it because url prefixed with "file://" is rejected by web view for some reason.
     In practice it means that after applying CodePush update and restarting app blank screen is appeared.
     To workaround it [webViewShared loadRequest] is called after self.webViewEngine loadRequest is called in the original viewDidLoad method.
     Note 1: self.webViewEngine loadRequest will be failing anyway but calling [webViewShared loadRequest] will hide it for user.
     Note 2: It affects only cordova-ios 6 apps
    */
    if([Utilities CDVWebViewEngineAvailable]) {
        WebViewShared* webViewShared = [WebViewShared getInstanceOrCreate:self.webViewEngine
                                                  andCommandDelegate:self.commandDelegate
                                                   andViewController:self];
        NSURL* url = [self appUrl];
        [webViewShared loadRequest:[NSURLRequest requestWithURL:url]];
    }
}

// Swizzling original viewDidLoad method
+ (void)load
{
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        Class class = [self class];

        SEL originalSelector = @selector(viewDidLoad);
        SEL swizzledSelector = @selector(viewDidLoad_codepush);

        Method originalMethod = class_getInstanceMethod(class, originalSelector);
        Method swizzledMethod = class_getInstanceMethod(class, swizzledSelector);

        BOOL didAddMethod = class_addMethod(class,
                                            originalSelector,
                                            method_getImplementation(swizzledMethod),
                                            method_getTypeEncoding(swizzledMethod));

        if (didAddMethod) {
            class_replaceMethod(class,
                                swizzledSelector,
                                method_getImplementation(originalMethod),
                                method_getTypeEncoding(originalMethod));
        } else {
            method_exchangeImplementations(originalMethod, swizzledMethod);
        }
    });
}

@end

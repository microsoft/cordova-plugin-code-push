#if defined(__has_include)
#if __has_include("CDVWKWebViewEngine.h")

#import "CDVWKWebViewEngine.h"
#import "WebViewShared.h"

@implementation CDVWKWebViewEngine (CodePush)

NSString* lastLoadedURL = @"";

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wobjc-protocol-method-implementation"

- (id)loadRequest:(NSURLRequest *)request {
    lastLoadedURL = request.URL.absoluteString;
    WebViewShared* webViewShared = [WebViewShared getInstanceOrCreate:self.webViewEngine
                                                            andCommandDelegate:self.commandDelegate
                                                             andViewController:self.viewController];
    return [webViewShared loadRequest:request];
}

#pragma clang diagnostic pop

// Fix bug related to unable WKWebView recovery after reinit with loaded codepush update
- (void)webView:(WKWebView*)theWebView didFailNavigation:(WKNavigation*)navigation withError:(NSError*)error {
    // NSURLErrorFailingURLStringErrorKey is URL which caused a load to fail, if it's null then webView was terminated for some reason
    if ([[error userInfo] objectForKey:NSURLErrorFailingURLStringErrorKey] == nil && [lastLoadedURL containsString:[WebViewShared getIdentifierCodePushPath]]) {
        NSLog(@"Failed to load webpage with error: %@", [error localizedDescription]);
        NSLog(@"Trying to reload request with url: %@", lastLoadedURL);
        // Manually loading codepush start page via loadRequest method of this category
        [self loadRequest: [NSURLRequest requestWithURL:[[NSURL alloc] initWithString:lastLoadedURL]]];
    } else {
        // Default implementation of didFailNavigation method of CDVWKWebViewEngine.m
        CDVViewController* vc = (CDVViewController*)self.viewController;
#ifndef __CORDOVA_6_0_0
        [CDVUserAgentUtil releaseLock:vc.userAgentLockToken];
#endif

        NSString* message = [NSString stringWithFormat:@"Failed to load webpage with error: %@", [error localizedDescription]];
        NSLog(@"%@", message);

        NSURL* errorUrl = vc.errorURL;
        if (errorUrl) {
            NSCharacterSet *charSet = [NSCharacterSet URLFragmentAllowedCharacterSet];
            errorUrl = [NSURL URLWithString:[NSString stringWithFormat:@"?error=%@", [message stringByAddingPercentEncodingWithAllowedCharacters:charSet]] relativeToURL:errorUrl];
            NSLog(@"%@", [errorUrl absoluteString]);
            [theWebView loadRequest:[NSURLRequest requestWithURL:errorUrl]];
        }
#ifdef DEBUG
        UIAlertController *alertController = [UIAlertController alertControllerWithTitle:[[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleDisplayName"] message:message preferredStyle:UIAlertControllerStyleAlert];
        [alertController addAction:[UIAlertAction actionWithTitle:NSLocalizedString(@"OK", nil) style:UIAlertActionStyleDefault handler:nil]];
        [vc presentViewController:alertController animated:YES completion:nil];
#endif
    }
}

@end

#endif
#endif

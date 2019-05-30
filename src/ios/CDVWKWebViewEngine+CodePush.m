#if defined(__has_include)
#if __has_include("CDVWKWebViewEngine.h")

#import "CDVWKWebViewEngine.h"
#import "CodePush.h"

@implementation CDVWKWebViewEngine (CodePush)

NSString* const IdentifierCodePushPath = @"codepush/deploy/versions";
BOOL navigationFailedFlag = false;

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wobjc-protocol-method-implementation"

- (id)loadRequest:(NSURLRequest *)request {
    NSURL *readAccessURL;

    if (request.URL.isFileURL) {
        // All file URL requests should be handled with the setServerBasePath in case if it is Ionic app.
        if ([CodePush hasIonicWebViewEngine: self]) {
            NSString* specifiedServerPath = [CodePush getCurrentServerBasePath];
            if (![specifiedServerPath containsString:IdentifierCodePushPath] || [request.URL.path containsString:IdentifierCodePushPath]) {
                [CodePush setServerBasePath:request.URL.path webView: self];
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

        return [(WKWebView*)self.engineWebView loadFileURL:request.URL allowingReadAccessToURL:readAccessURL];
    } else {
        return [(WKWebView*)self.engineWebView loadRequest: request];
    }
}

#pragma clang diagnostic pop

- (void)webView:(WKWebView*)theWebView didFailNavigation:(WKNavigation*)navigation withError:(NSError*)error
{
    CDVViewController* vc = (CDVViewController*)self.viewController;
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(resetNavigationFailedFlag:) name:CDVPageDidLoadNotification object:nil];
    // Humble check for preventing infinity loop with navigation error handlers
    if (!navigationFailedFlag) {
        navigationFailedFlag = true;
        [self loadRequest: [NSURLRequest requestWithURL:[[NSURL alloc] initWithString:[vc startPage]]]];
    } else {
        [self resetNavigationFailedFlag:nil];
        NSString* message = [NSString stringWithFormat:@"Failed to load webpage with error: %@", [error localizedDescription]];
        NSLog(@"%@", message);
        [CDVUserAgentUtil releaseLock:vc.userAgentLockToken];
        NSURL* errorUrl = vc.errorURL;
        if (errorUrl) {
            errorUrl = [NSURL URLWithString:[NSString stringWithFormat:@"?error=%@", [message stringByAddingPercentEscapesUsingEncoding:NSUTF8StringEncoding]] relativeToURL:errorUrl];
            NSLog(@"%@", [errorUrl absoluteString]);
            [theWebView loadRequest:[NSURLRequest requestWithURL:errorUrl]];
        }
    }
}

- (void)resetNavigationFailedFlag:(NSNotification*)notification
{
    navigationFailedFlag = false;
    [[NSNotificationCenter defaultCenter] removeObserver:self name:CDVPageDidLoadNotification object:nil];
}

@end

#endif
#endif

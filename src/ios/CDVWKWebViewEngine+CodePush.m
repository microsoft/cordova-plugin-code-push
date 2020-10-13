#if defined(__has_include)
#if __has_include("CDVWKWebViewEngine.h")

#import <Cordova/NSDictionary+CordovaPreferences.h>
#import "CDVWKWebViewEngine.h"
#import "CodePush.h"

@implementation CDVWKWebViewEngine (CodePush)

NSString* const IdentifierCodePushPath = @"codepush/deploy/versions";
NSString* lastLoadedURL = @"";

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wobjc-protocol-method-implementation"

- (id)loadRequest:(NSURLRequest *)request {
    lastLoadedURL = request.URL.absoluteString;
    NSURL *readAccessURL;

    NSURL* bundleURL = [[NSBundle mainBundle] bundleURL];
    if (![lastLoadedURL containsString:bundleURL.path] && ![lastLoadedURL containsString:IdentifierCodePushPath]) {
        return [self loadPluginRequest:request];
    }

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

- (id)loadPluginRequest:(NSURLRequest *)request {
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
    return [(WKWebView*)self.engineWebView loadRequest:request];
}

#pragma clang diagnostic pop

// Fix bug related to unable WKWebView recovery after reinit with loaded codepush update
- (void)webView:(WKWebView*)theWebView didFailNavigation:(WKNavigation*)navigation withError:(NSError*)error {
    // NSURLErrorFailingURLStringErrorKey is URL which caused a load to fail, if it's null then webView was terminated for some reason
    if ([[error userInfo] objectForKey:NSURLErrorFailingURLStringErrorKey] == nil && [lastLoadedURL containsString:IdentifierCodePushPath]) {
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

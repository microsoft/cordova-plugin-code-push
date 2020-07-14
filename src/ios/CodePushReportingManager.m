#import "CodePushReportingManager.h"
#import "StatusReport.h"

#pragma GCC diagnostic ignored "-Wundeclared-selector"

@implementation CodePushReportingManager

int HasFailedReport = -1; // -1 = unset, 0 = false, 1 = true

NSString* const FailedStatusReportKey = @"CODE_PUSH_FAILED_STATUS_REPORT_KEY";
NSString* const LastVersionPreference = @"CODE_PUSH_LAST_VERSION";
NSString* const LastVersionPreferenceDeploymentKeyKey = @"LAST_VERSION_DEPLOYMENT_KEY_KEY";
NSString* const LastVersionPreferenceLabelOrAppVersionKey = @"LAST_VERSION_LABEL_OR_APP_VERSION_KEY";

+ (void)reportStatus:(StatusReport*)statusReport withWebView:(UIView*)webView {
    @synchronized(self) {
        if (!statusReport.deploymentKey) {
            return;
        }

        NSString* labelParameter = [CodePushReportingManager convertStringParameter:statusReport.label];
        NSString* appVersionParameter = [CodePushReportingManager convertStringParameter:statusReport.appVersion];
        NSString* deploymentKeyParameter = [CodePushReportingManager convertStringParameter:statusReport.deploymentKey];
        NSString* lastVersionLabelOrAppVersionParameter = statusReport.lastVersionLabelOrAppVersion;
        NSString* lastVersionDeploymentKeyParameter = statusReport.lastVersionDeploymentKey;
        if (!lastVersionLabelOrAppVersionParameter && !lastVersionDeploymentKeyParameter) {
            NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
            NSDictionary* lastVersion = [preferences objectForKey:LastVersionPreference];
            if (lastVersion) {
                lastVersionLabelOrAppVersionParameter = [CodePushReportingManager convertStringParameter:[lastVersion objectForKey:LastVersionPreferenceLabelOrAppVersionKey]];
                lastVersionDeploymentKeyParameter = [CodePushReportingManager convertStringParameter:[lastVersion objectForKey:LastVersionPreferenceDeploymentKeyKey]];
            }
        }

        /* JS function to call: window.codePush.reportStatus(status: number, label: String, appVersion: String, deploymentKey: String) */
        NSString* script = [NSString stringWithFormat:@"document.addEventListener(\"deviceready\", function () { window.codePush.reportStatus(%i, %@, %@, %@, %@, %@); });", (int)statusReport.status, labelParameter, appVersionParameter, deploymentKeyParameter, lastVersionLabelOrAppVersionParameter, lastVersionDeploymentKeyParameter];
        #if WK_WEB_VIEW_ONLY
        if ([webView respondsToSelector:@selector(evaluateJavaScript:completionHandler:)]) {
            // The WKWebView requires JS evaluation to occur on the main
            // thread starting with iOS11, so ensure that we dispatch to it before executing.
            dispatch_async(dispatch_get_main_queue(), ^{
                [webView performSelector:@selector(evaluateJavaScript:completionHandler:) withObject:script withObject: NULL];
            });
        }
        #else
        if ([webView respondsToSelector:@selector(evaluateJavaScript:completionHandler:)]) {
            // The WKWebView requires JS evaluation to occur on the main
            // thread starting with iOS11, so ensure that we dispatch to it before executing.
            dispatch_async(dispatch_get_main_queue(), ^{
                [webView performSelector:@selector(evaluateJavaScript:completionHandler:) withObject:script withObject: NULL];
            });
        } else if ([webView isKindOfClass:[UIWebView class]]) {
            // The UIWebView requires JS evaluation to occur on the main
            // thread, so ensure that we dispatch to it before executing.
            dispatch_async(dispatch_get_main_queue(), ^{
                [(UIWebView*)webView stringByEvaluatingJavaScriptFromString:script];
            });
        }
        #endif
    }
}

+ (NSString*)convertStringParameter:(NSString*)input {
    if (!input) {
        return @"undefined";
    } else {
        return [NSString stringWithFormat:@"'%@'", input];
    }
}

+ (BOOL)hasFailedReport {
    if (HasFailedReport == -1) {
        HasFailedReport = [self getFailedReport] != nil;
    }

    return HasFailedReport;
}

+ (StatusReport*)getFailedReport {
    NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
    NSDictionary* failedReportDict = [preferences objectForKey:FailedStatusReportKey];
    if (!failedReportDict) {
        return nil;
    }

    return [[StatusReport alloc] initWithDictionary:failedReportDict];
}

+ (StatusReport*)getAndClearFailedReport {
    StatusReport* failedReport = [self getFailedReport];
    [self clearFailedReport];
    HasFailedReport = 0;
    return failedReport;
}

+ (void)clearFailedReport {
    NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
    [preferences removeObjectForKey:FailedStatusReportKey];
    [preferences synchronize];
}

+ (void)saveFailedReport:(StatusReport*)statusReport {
    NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
    [preferences setObject:[statusReport toDictionary] forKey:FailedStatusReportKey];
    [preferences synchronize];
    HasFailedReport = 1;
}

+ (void)saveSuccessfulReport:(StatusReport*)statusReport {
    if (statusReport.status == STORE_VERSION || statusReport.status == UPDATE_CONFIRMED) {
        NSDictionary* newLastVersion = @{
                                         LastVersionPreferenceLabelOrAppVersionKey:(statusReport.label ? statusReport.label : statusReport.appVersion),
                                         LastVersionPreferenceDeploymentKeyKey:statusReport.deploymentKey
                                        };
        NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
        [preferences setObject:newLastVersion forKey:LastVersionPreference];
        [preferences synchronize];
        [self clearFailedReport];
        HasFailedReport = 0;
    }
}

@end



#import "CodePushReportingManager.h"

@implementation CodePushReportingManager

const NSString* LastVersionPreference = @"CODE_PUSH_LAST_VERSION";
const NSString* LastVersionDeploymentKeyKey = @"LAST_VERSION_DEPLOYMENT_KEY_KEY";
const NSString* LastVersionLabelOrAppVersionKey = @"LAST_VERSION_LABEL_OR_APP_VERSION_KEY";

+ (void)reportStatus:(ReportingStatus)status withLabel:(NSString*)label version:(NSString*)version deploymentKey:(NSString*)deploymentKey webView:(UIView*)webView {
    @synchronized(self) {
        NSString* labelParameter = [CodePushReportingManager convertStringParameter:label];
        NSString* appVersionParameter = [CodePushReportingManager convertStringParameter:version];
        NSString* deploymentKeyParameter = [CodePushReportingManager convertStringParameter:deploymentKey];
        NSString* lastVersionLabelOrAppVersionParameter = nil;
        NSString* lastVersionDeploymentKeyParameter = nil;

        NSUserDefaults* preferences = [NSUserDefaults standardUserDefaults];
        NSDictionary* lastVersion = [preferences objectForKey:LastVersionPreference];
        if (lastVersion) {
            lastVersionLabelOrAppVersionParameter = [CodePushReportingManager convertStringParameter:[lastVersion objectForKey:LastVersionLabelOrAppVersionKey]];
            lastVersionDeploymentKeyParameter = [CodePushReportingManager convertStringParameter:[lastVersion objectForKey:LastVersionDeploymentKeyKey]];
        }

        /* JS function to call: window.codePush.reportStatus(status: number, label: String, appVersion: String, deploymentKey: String) */
        NSString* script = [NSString stringWithFormat:@"window.codePush.reportStatus(%i, %@, %@, %@, %@, %@)", (int)status, labelParameter, appVersionParameter, deploymentKeyParameter, lastVersionLabelOrAppVersionParameter, lastVersionDeploymentKeyParameter];
        if ([webView respondsToSelector:@selector(evaluateJavaScript:completionHandler:)]) {
            [webView performSelector:@selector(evaluateJavaScript:completionHandler:) withObject:script withObject: NULL];
        } else if ([webView isKindOfClass:[UIWebView class]]) {
            [(UIWebView*)webView stringByEvaluatingJavaScriptFromString:script];
        }

        if (status == STORE_VERSION || status == UPDATE_CONFIRMED) {
            NSDictionary* newLastVersion = @{LastVersionLabelOrAppVersionKey:(label ? label : version), LastVersionDeploymentKeyKey:deploymentKey};
            [preferences setObject:newLastVersion forKey:LastVersionPreference];
            [preferences synchronize];
        }
    }
}

+ (NSString*)convertStringParameter:(NSString*)input {
    if (!input) {
        return @"undefined";
    } else {
        return [NSString stringWithFormat:@"'%@'", input];
    }
}

@end



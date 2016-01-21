#import "Reporting.h"

@interface PendingStatus : NSObject
@property ReportingStatus status;
@property NSString* label;
@property NSString* appVersion;
@property NSString* deploymentKey;
@end

@implementation PendingStatus
@end


@implementation Reporting

static NSMutableArray* PendingStatuses;

+ (void)saveStatus:(ReportingStatus)status withLabel:(NSString*)label version:(NSString*)version deploymentKey:(NSString*)deploymentKey {
    @synchronized(self) {
        PendingStatus* pendingStatus = [[PendingStatus alloc] init];
        [pendingStatus setStatus:status];
        [pendingStatus setLabel:label];
        [pendingStatus setAppVersion:version];
        [pendingStatus setDeploymentKey:deploymentKey];
        if (!PendingStatuses) {
            PendingStatuses = [[NSMutableArray alloc] init];
        }
        [PendingStatuses addObject:pendingStatus];
    }
    
}

+ (void)reportStatuses:(UIWebView*)webView {
    @synchronized(self) {
        if ((nil != PendingStatuses) && ([PendingStatuses count] > 0)) {
            for (PendingStatus* status in PendingStatuses) {
                [Reporting reportStatus:status forView:webView];
            }
            [PendingStatuses removeAllObjects];
        }
    }
}

+ (void)reportStatus:(PendingStatus*)pendingStatus forView:(UIWebView*)webView {
    /* report status to the JS layer */
    NSString* labelParameter = [Reporting convertStringParameter:pendingStatus.label];
    NSString* appVersionParameter = [Reporting convertStringParameter:pendingStatus.appVersion];
    NSString* deploymentKeyParameter = [Reporting convertStringParameter:pendingStatus.deploymentKey];
    /* JS function to call: window.codePush.reportStatus(status: number, label: String, appVersion: String, deploymentKey: String) */
    NSString* script = [NSString stringWithFormat:@"window.codePush.reportStatus(%i, %@, %@, %@)", (int)pendingStatus.status, labelParameter, appVersionParameter, deploymentKeyParameter];
    [webView stringByEvaluatingJavaScriptFromString:script];
}

+ (NSString*)convertStringParameter:(NSString*)input {
    if (!input) {
        return @"undefined";
    } else {
        return [NSString stringWithFormat:@"'%@'", input];
    }
}

@end



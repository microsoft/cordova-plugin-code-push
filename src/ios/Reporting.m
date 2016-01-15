#import "Reporting.h"

@interface PendingStatus : NSObject
@property ReportingStatus status;
@property NSString* label;
@property NSString* appVersion;
@end

@implementation PendingStatus
@end


@implementation Reporting

static NSMutableArray* PendingStatuses;

+ (void)saveStatus:(ReportingStatus)status withLabel:(NSString*)label andVersion:(NSString*)version {
    @synchronized(self) {
        PendingStatus* pendingStatus = [[PendingStatus alloc] init];
        [pendingStatus setStatus:status];
        [pendingStatus setLabel:label];
        [pendingStatus setAppVersion:version];
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
    /* JS function to call: window.codePush.reportStatus(status: number, label: String, appVersion: String) */
    NSString* script = [NSString stringWithFormat:@"window.codePush.reportStatus(%i, '%@', '%@')", (int)pendingStatus.status, pendingStatus.label, pendingStatus.appVersion];
    [webView stringByEvaluatingJavaScriptFromString:script];
}

@end



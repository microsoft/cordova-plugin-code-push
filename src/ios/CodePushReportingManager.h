#import "StatusReport.h"

@interface CodePushReportingManager : NSObject

+ (void)reportStatus:(StatusReport*)statusReport withWebView:(UIView*)webView;
+ (BOOL)hasFailedReport;
+ (StatusReport*)getFailedReport;
+ (StatusReport*)getAndClearFailedReport;
+ (void)saveFailedReport:(StatusReport*)statusReport;
+ (void)saveSuccessfulReport:(StatusReport*)statusReport;

@end
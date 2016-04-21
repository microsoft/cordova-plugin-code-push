enum {
    STORE_VERSION = 0,
    UPDATE_CONFIRMED = 1,
    UPDATE_ROLLED_BACK = 2
};
typedef NSInteger ReportingStatus;

@interface CodePushReportingManager : NSObject
+ (void)reportStatus:(ReportingStatus)status withLabel:(NSString*)label version:(NSString*)version deploymentKey:(NSString*)deploymentKey webView:(UIView*)webView;
@end


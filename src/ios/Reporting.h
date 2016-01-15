enum {
    STORE_VERSION = 0,
    UPDATE_CONFIRMED = 1,
    UPDATE_ROLLED_BACK = 2
};
typedef NSInteger ReportingStatus;

@interface Reporting : NSObject
+ (void)saveStatus:(ReportingStatus)status withLabel:(NSString*)label andVersion:(NSString*)version;
+ (void)reportStatuses:(UIWebView*)webView;
@end


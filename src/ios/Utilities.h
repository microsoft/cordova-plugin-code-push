@interface Utilities : NSObject

+ (NSString*)getApplicationVersion;
+ (NSString*)getApplicationTimestamp;
+ (NSDate*)getApplicationBuildTime;
+ (BOOL)CDVWebViewEngineAvailable;

@end
@interface Utilities : NSObject

+ (NSString*)getApplicationVersion;
+ (NSString*)getApplicationTimestamp;
+ (NSDate*)getApplicationBuildTime;
+ (BOOL)cordova6OrGreater;

@end
#import "Utilities.h"

@implementation Utilities

+ (NSString*)getApplicationVersion{
    return [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
}

+ (NSString*)getApplicationTimestamp{
    NSDate* applicationBuildTime = [self getApplicationBuildTime];
    if (applicationBuildTime){
        NSNumber* timestamp = [[NSNumber alloc] initWithDouble: floor([applicationBuildTime timeIntervalSince1970] * 1000)];
        return [timestamp stringValue];
    }
    
    return nil;
}

+ (NSDate*)getApplicationBuildTime{   
    NSString *dateStr = [NSString stringWithUTF8String:__DATE__];
    NSString *timeStr = [NSString stringWithUTF8String:__TIME__];

    NSString *dateTimeStr = [NSString stringWithFormat:@"%@ %@", dateStr, timeStr];

    // Convert to date
    NSDateFormatter *dateFormat = [[NSDateFormatter alloc] init];
    [dateFormat setDateFormat:@"LLL d yyyy HH:mm:ss"];
    NSDate *date = [dateFormat dateFromString:dateTimeStr];

    return date;
}

@end
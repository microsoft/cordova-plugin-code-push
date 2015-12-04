#import "Utilities.h"

@implementation Utilities

+ (NSString*)getApplicationTimestamp{
    NSDate* applicationBuildTime = [self getApplicationBuildTime];
    if (applicationBuildTime){
        NSNumber* timestamp = [[NSNumber alloc] initWithDouble: floor([applicationBuildTime timeIntervalSince1970] * 1000)];
        return [timestamp stringValue];
    }
    
    return nil;
}

+ (NSDate*)getApplicationBuildTime{
    NSString *appPath = [[NSBundle mainBundle] bundlePath];
    NSDictionary *executableAttributes = [[NSFileManager defaultManager] attributesOfItemAtPath:appPath error:nil];
    return [executableAttributes objectForKey:@"NSFileModificationDate"];
}

@end
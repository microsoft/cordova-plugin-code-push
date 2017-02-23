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
    //get path for plist file to check modification date because iOS10.2 failed to get modification date of main bundle 
    NSString *appPlistPath = [[NSBundle mainBundle] pathForResource:nil ofType:@"plist"];
    NSDictionary *executableAttributes = [[NSFileManager defaultManager] attributesOfItemAtPath:appPlistPath error:nil];
    NSDate *fileDate = [executableAttributes objectForKey:@"NSFileModificationDate"];
    return fileDate;
}

@end
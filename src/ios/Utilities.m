#import "Utilities.h"

@implementation Utilities

static NSNumber* CDVWebViewEngineExists = nil;

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

+ (BOOL)CDVWebViewEngineAvailable{
    if(CDVWebViewEngineExists == nil) {
        BOOL value = NSClassFromString(@"CDVWebViewEngine") != nil;
        CDVWebViewEngineExists = [NSNumber numberWithBool:value];
    }
    return [CDVWebViewEngineExists boolValue];
}

void CPLog(NSString *formatString, ...) {
    va_list args;
    va_start(args, formatString);
    NSString *prependedFormatString = [NSString stringWithFormat:@"\n[CodePush] %@", formatString];
    NSLogv(prependedFormatString, args);
    va_end(args);
}

@end

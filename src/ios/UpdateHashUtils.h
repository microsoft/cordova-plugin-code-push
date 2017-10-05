@interface UpdateHashUtils : NSObject

+ (NSString*)getBinaryHash:(NSError**)error;
+ (NSString*)getHashForPath:(NSString*)path error:(NSError**)error;

@end
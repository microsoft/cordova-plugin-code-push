#include <CommonCrypto/CommonDigest.h>

@implementation UpdateHashUtils : NSObject

+ (NSString*)binaryAssetsPath
{
    return [[[NSBundle mainBundle] resourcePath] stringByAppendingPathComponent:@"www"];
}

+ (void)addFolderEntriesToManifest:(NSString*)folderPath
                        pathPrefix:(NSString*)pathPrefix
                   manifestEntries:(NSMutableArray*)manifestEntries
                             error:(NSError**)error
{
    NSArray* folderFiles = [[NSFileManager defaultManager]
                            contentsOfDirectoryAtPath:folderPath
                            error:error];
    if (*error) {
        return;
    }
    
    for (NSString* fileName in folderFiles) {
        NSString* fullFilePath = [folderPath stringByAppendingPathComponent:fileName];
        NSString* relativePath = [pathPrefix stringByAppendingPathComponent:fileName];
        BOOL isDir = NO;
        if ([[NSFileManager defaultManager] fileExistsAtPath:fullFilePath
                                                 isDirectory:&isDir] && isDir) {
            [self addFolderEntriesToManifest:fullFilePath
                                  pathPrefix:relativePath
                             manifestEntries:manifestEntries
                                       error:error];
            if (*error) {
                return;
            }
        } else {
            NSData* fileContents = [NSData dataWithContentsOfFile:fullFilePath];
            NSString* fileContentsHash = [self computeHashForData:fileContents];
            [manifestEntries addObject:[[relativePath stringByAppendingString:@":"] stringByAppendingString:fileContentsHash]];
        }
    }
}

+ (NSString*)computeFinalHashFromManifestEntries:(NSMutableArray*)manifest
                                           error:(NSError**)error
{
    NSArray* sortedManifest = [manifest sortedArrayUsingSelector:@selector(compare:)];
    NSData* manifestData = [NSJSONSerialization dataWithJSONObject:sortedManifest
                                                           options:kNilOptions
                                                             error:error];
    if (*error) {
        return nil;
    }
    
    NSString* manifestString = [[NSString alloc] initWithData:manifestData
                                                     encoding:NSUTF8StringEncoding];
    // The JSON serialization turns path separators into "\/", e.g. "www\/images\/image.png"
    manifestString = [manifestString stringByReplacingOccurrencesOfString:@"\\/"
                                                               withString:@"/"];
    return [self computeHashForData:[NSData dataWithBytes:manifestString.UTF8String length:manifestString.length]];
}

+ (NSString*)computeHashForData:(NSData*)inputData
{
    uint8_t digest[CC_SHA256_DIGEST_LENGTH];
    CC_SHA256(inputData.bytes, inputData.length, digest);
    NSMutableString* inputHash = [NSMutableString stringWithCapacity:CC_SHA256_DIGEST_LENGTH * 2];
    for (int i = 0; i < CC_SHA256_DIGEST_LENGTH; i++) {
        [inputHash appendFormat:@"%02x", digest[i]];
    }
    
    return inputHash;
}

+ (NSString*)getBinaryHash:(NSError**)error
{
    NSMutableArray* manifestEntries = [NSMutableArray array];
    [self addFolderEntriesToManifest:[self binaryAssetsPath]
                          pathPrefix:@"www"
                     manifestEntries:manifestEntries
                               error:error];
    return [self computeFinalHashFromManifestEntries:manifestEntries error:error];
}

@end
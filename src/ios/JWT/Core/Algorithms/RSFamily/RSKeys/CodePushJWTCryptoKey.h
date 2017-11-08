//
//  JWTCryptoKey.h
//  JWT
//
//  Created by Lobanov Dmitry on 04.02.17.
//  Copyright © 2017 JWTIO. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <Security/Security.h>

@protocol JWTCryptoKeyProtocol <NSObject>
@property (copy, nonatomic, readonly) NSString *tag;
@property (assign, nonatomic, readonly) SecKeyRef key;
@property (copy, nonatomic, readonly) NSData *rawKey;
@end

@protocol JWTCryptoKey__Generator__Protocol
- (instancetype)initWithData:(NSData *)data parameters:(NSDictionary *)parameters error:(NSError *__autoreleasing*)error; //NS_DESIGNATED_INITIALIZER
- (instancetype)initWithBase64String:(NSString *)base64String parameters:(NSDictionary *)parameters error:(NSError *__autoreleasing*)error;
- (instancetype)initWithPemEncoded:(NSString *)encoded parameters:(NSDictionary *)parameters error:(NSError *__autoreleasing*)error;
- (instancetype)initWithPemAtURL:(NSURL *)url parameters:(NSDictionary *)parameters error:(NSError *__autoreleasing*)error;
@end

@interface JWTCryptoKeyBuilder : NSObject
@property (assign, nonatomic, readonly) NSString *keyType;
- (instancetype)keyTypeRSA;
- (instancetype)keyTypeEC;
@end

/*
 Don't use it directly, use subclasses instead!
 */
@interface JWTCryptoKey : NSObject<JWTCryptoKeyProtocol> @end

// Check that Security key is retrieved.
// Could be used as additional step in key data verification.
@interface JWTCryptoKey (Check)
- (instancetype)checkedWithError:(NSError *__autoreleasing*)error;
@end

@interface JWTCryptoKey (Parameters)
+ (NSString *)parametersKeyBuilder;
@end

@interface JWTCryptoKeyPublic : JWTCryptoKey <JWTCryptoKey__Generator__Protocol>
- (instancetype)initWithCertificateData:(NSData *)certificateData parameters:(NSDictionary *)parameters error:(NSError *__autoreleasing*)error; //NS_DESIGNATED_INITIALIZER;
- (instancetype)initWithCertificateBase64String:(NSString *)certificateString parameters:(NSDictionary *)parameters error:(NSError *__autoreleasing*)error;
@end

@interface JWTCryptoKeyPrivate : JWTCryptoKey <JWTCryptoKey__Generator__Protocol>
- (instancetype)initWithP12Data:(NSData *)p12Data withPassphrase:(NSString *)passphrase parameters:(NSDictionary *)parameters error:(NSError *__autoreleasing*)error; //NS_DESIGNATED_INITIALIZER;
- (instancetype)initWithP12AtURL:(NSURL *)url withPassphrase:(NSString *)passphrase parameters:(NSDictionary *)parameters error:(NSError *__autoreleasing*)error;
@end

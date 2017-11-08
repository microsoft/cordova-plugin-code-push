//
//  JWTAlgorithmFactory.h
//  JWT
//
//  Created by Lobanov Dmitry on 07.10.15.
//  Copyright © 2015 Karma. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "CodePushJWTAlgorithm.h"
@interface JWTAlgorithmFactory : NSObject

+ (NSArray *)algorithms;
+ (id<JWTAlgorithm>)algorithmByName:(NSString *)name;

@end

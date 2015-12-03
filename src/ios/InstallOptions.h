#include "InstallMode.h"

@interface InstallOptions : NSObject

@property NSInteger rollbackTimeout;
@property InstallMode installMode;

-(void)encodeWithCoder:(NSCoder*)encoder;
-(id)initWithCoder:(NSCoder*)decoder;

@end
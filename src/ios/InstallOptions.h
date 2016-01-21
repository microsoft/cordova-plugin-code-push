#include "InstallMode.h"

@interface InstallOptions : NSObject

@property InstallMode installMode;

-(void)encodeWithCoder:(NSCoder*)encoder;
-(id)initWithCoder:(NSCoder*)decoder;

@end
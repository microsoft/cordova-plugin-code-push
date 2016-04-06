#include "InstallMode.h"

@interface InstallOptions : NSObject

@property InstallMode installMode;
@property int minimumBackgroundDuration;

-(void)encodeWithCoder:(NSCoder*)encoder;
-(id)initWithCoder:(NSCoder*)decoder;

@end
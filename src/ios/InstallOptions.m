#include "InstallOptions.h"

@implementation InstallOptions

NSString* const InstallModeKey = @"installMode";
NSString* const MinimumBackgroundDurationKey = @"minimumBackgroundDuration";

-(void)encodeWithCoder:(NSCoder*)encoder {
    [encoder encodeInteger:self.installMode forKey:InstallModeKey];
    [encoder encodeInteger:self.minimumBackgroundDuration forKey:MinimumBackgroundDurationKey];
}

-(id)initWithCoder:(NSCoder*)decoder {    
    self.installMode = [decoder decodeIntegerForKey:InstallModeKey];
    self.minimumBackgroundDuration = [decoder decodeIntegerForKey:MinimumBackgroundDurationKey];
    return self;
}

@end
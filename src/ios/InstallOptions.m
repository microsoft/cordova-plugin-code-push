#include "InstallOptions.h"

@implementation InstallOptions

NSString* const InstallModeKey = @"installMode";

-(void)encodeWithCoder:(NSCoder*)encoder {
    [encoder encodeInteger:self.installMode forKey:InstallModeKey];
}

-(id)initWithCoder:(NSCoder*)decoder {    
    self.installMode = [decoder decodeIntegerForKey:InstallModeKey];
    return self;
}

@end
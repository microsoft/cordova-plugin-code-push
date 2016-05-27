#import "StatusReport.h"

@implementation StatusReport

const NSString* StatusKey = @"status";
const NSString* LabelKey = @"label";
const NSString* AppVersionKey = @"appVersion";
const NSString* DeploymentKeyKey = @"deploymentKey";
const NSString* LastVersionLabelOrAppVersionKey = @"lastVersionLabelOrAppVersion";
const NSString* LastVersionDeploymentKeyKey = @"lastVersionDeploymentKey";

- (id)initWithStatus:(ReportingStatus)status andLabel:(NSString*)label andAppVersion:(NSString*)appVersion andDeploymentKey:(NSString*)deploymentKey {
    return [self initWithStatus:status andLabel:label andAppVersion:appVersion andDeploymentKey:deploymentKey andLastVersionLabelOrAppVersion:nil andLastVersionDeploymentKey:nil];
}


- (id)initWithStatus:(ReportingStatus)status andLabel:(NSString*)label andAppVersion:(NSString*)appVersion andDeploymentKey:(NSString*)deploymentKey andLastVersionLabelOrAppVersion:(NSString*)lastVersionLabelOrAppVersion andLastVersionDeploymentKey:(NSString*)lastVersionDeploymentKey {
    self = [super init];
    if (self) {
        _status = status;
        _label = label;
        _appVersion = appVersion;
        _deploymentKey = deploymentKey;
        _lastVersionLabelOrAppVersion = lastVersionLabelOrAppVersion;
        _lastVersionDeploymentKey = lastVersionDeploymentKey;
    }
    
    return self;
}

- (id)initWithDictionary:(NSDictionary*)dict {
    return [self initWithStatus:[dict[StatusKey] longValue] andLabel:dict[LabelKey] andAppVersion:dict[AppVersionKey] andDeploymentKey:dict[DeploymentKeyKey] andLastVersionLabelOrAppVersion:dict[LastVersionLabelOrAppVersionKey] andLastVersionDeploymentKey:dict[LastVersionDeploymentKeyKey]];
}

- (NSDictionary*)toDictionary {
    NSMutableDictionary* dict = [[NSMutableDictionary alloc] init];
    dict[StatusKey] = @(_status);
    if (_label) dict[LabelKey] = _label;
    if (_appVersion) dict[AppVersionKey] = _appVersion;
    if (_deploymentKey) dict[DeploymentKeyKey] = _deploymentKey;
    if (_lastVersionLabelOrAppVersion) dict[LastVersionLabelOrAppVersionKey] = _lastVersionLabelOrAppVersion;
    if (_lastVersionDeploymentKey) dict[LastVersionDeploymentKeyKey] = _lastVersionDeploymentKey;
    return dict;
}

@end
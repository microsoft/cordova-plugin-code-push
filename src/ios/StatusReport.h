enum {
    STORE_VERSION = 0,
    UPDATE_CONFIRMED = 1,
    UPDATE_ROLLED_BACK = 2
};
typedef NSInteger ReportingStatus;

@interface StatusReport : NSObject

@property ReportingStatus status;
@property NSString* label;
@property NSString* appVersion;
@property NSString* deploymentKey;

// Optional properties.
@property NSString* lastVersionLabelOrAppVersion;
@property NSString* lastVersionDeploymentKey;

- (id)initWithStatus:(ReportingStatus)status andLabel:(NSString*)label andAppVersion:(NSString*)appVersion andDeploymentKey:(NSString*)deploymentKey;

- (id)initWithStatus:(ReportingStatus)status andLabel:(NSString*)label andAppVersion:(NSString*)appVersion andDeploymentKey:(NSString*)deploymentKey andLastVersionLabelOrAppVersion:(NSString*)lastVersionLabelOrAppVersion andLastVersionDeploymentKey:(NSString*)lastVersionDeploymentKey;

- (id)initWithDictionary:(NSDictionary*)dict;

- (NSDictionary*)toDictionary;

@end
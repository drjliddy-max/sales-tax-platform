import { POSSystemType, AuthCredentials, POSDetectionResult, POSConfiguration } from './types';
export declare class POSDetector {
    private static readonly DETECTION_TIMEOUT;
    private static readonly MAX_PARALLEL_TESTS;
    private static readonly POS_FINGERPRINTS;
    private static readonly SCHEMA_MAPPINGS;
    private static readonly RATE_LIMITS;
    static detectPOSSystem(credentials: AuthCredentials): Promise<POSDetectionResult>;
    private static testPOSSystem;
    private static buildTestUrl;
    private static buildAuthHeaders;
    private static calculateConfidence;
    private static getSupportedFeatures;
    private static getRequiredCredentials;
    static validateCredentials(posType: POSSystemType, credentials: AuthCredentials): boolean;
    static getConfigurationTemplate(posType: POSSystemType): Partial<POSConfiguration>;
}
//# sourceMappingURL=detection.d.ts.map
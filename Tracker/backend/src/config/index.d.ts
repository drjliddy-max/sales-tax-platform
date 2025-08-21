export declare const config: {
    server: {
        port: string | number;
        environment: string;
        corsOrigins: string[];
    };
    database: {
        url: string | undefined;
        name: string;
        maxConnections: number;
        timeout: number;
    };
    auth: {
        jwtSecret: string;
        jwtExpiry: string;
        clerkSecretKey: string | undefined;
        clerkPublishableKey: string | undefined;
    };
    redis: {
        url: string | undefined;
        maxRetries: number;
        retryDelay: number;
    };
    email: {
        smtpHost: string | undefined;
        smtpPort: number;
        smtpUser: string | undefined;
        smtpPassword: string | undefined;
        fromAddress: string;
    };
    apis: {
        taxJarApiKey: string | undefined;
        stripeSecretKey: string | undefined;
        stripePublishableKey: string | undefined;
    };
    features: {
        enablePosRegistry: boolean;
        enableAdvancedAnalytics: boolean;
        enableReporting: boolean;
        enableIntegrations: boolean;
    };
    rateLimits: {
        windowMs: number;
        maxRequests: number;
        authMaxRequests: number;
    };
    logging: {
        level: string;
        enableConsole: boolean;
        enableFile: boolean;
        logFile: string;
    };
    pos: {
        pluginTimeout: number;
        maxRetries: number;
        webhookSecret: string;
    };
};
export declare const validateEnvironment: () => void;
export default config;
//# sourceMappingURL=index.d.ts.map
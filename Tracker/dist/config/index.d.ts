export declare const config: {
    server: {
        port: number;
        env: string;
    };
    database: {
        url: string;
        name: string;
    };
    auth: {
        jwtSecret: string;
        jwtExpiresIn: string;
    };
    integrations: {
        square: {
            applicationId: string | undefined;
            accessToken: string | undefined;
            environment: string;
        };
        shopify: {
            apiKey: string | undefined;
            apiSecret: string | undefined;
        };
        avalara: {
            apiKey: string | undefined;
            accountId: string | undefined;
        };
        taxjar: {
            apiKey: string | undefined;
        };
        quickbooks: {
            clientId: string | undefined;
            clientSecret: string | undefined;
        };
    };
    redis: {
        url: string;
    };
    logging: {
        level: string;
    };
    monitoring: {
        sentryDsn: string;
        sentryEnvironment: string;
        sentryRelease: string;
    };
    auth0: {
        domain: string;
        clientId: string;
        clientSecret: string;
        audience: string;
        issuerBaseUrl: string;
    };
};
//# sourceMappingURL=index.d.ts.map
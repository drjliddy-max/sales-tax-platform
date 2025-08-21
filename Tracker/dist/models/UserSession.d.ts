import mongoose, { Document } from 'mongoose';
export interface IUserSession extends Document {
    userId: string;
    businessId?: string;
    sessionToken: string;
    auth0SessionId?: string;
    ipAddress: string;
    userAgent: string;
    isActive: boolean;
    loginTime: Date;
    lastActivity: Date;
    logoutTime?: Date;
    expiresAt: Date;
    securityFlags: {
        isSuspicious: boolean;
        riskScore: number;
        geoLocation?: {
            country?: string;
            region?: string;
            city?: string;
        };
        deviceFingerprint?: string;
        multipleActiveDevices?: boolean;
    };
    metadata: {
        loginMethod?: 'password' | 'social' | 'sso' | 'mfa';
        browser?: string;
        platform?: string;
        referrer?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IUserSession, {}, {}, {}, mongoose.Document<unknown, {}, IUserSession> & IUserSession & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default _default;
//# sourceMappingURL=UserSession.d.ts.map
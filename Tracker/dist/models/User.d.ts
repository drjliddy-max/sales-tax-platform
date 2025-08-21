import mongoose, { Document } from 'mongoose';
import { UserRole } from '@/services/auth/Auth0Service';
export interface IUser extends Document {
    auth0Id: string;
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    profilePicture?: string;
    emailVerified: boolean;
    isActive: boolean;
    lastLogin?: Date;
    businessAccesses: Array<{
        businessId: string;
        role: UserRole;
        permissions: string[];
        isActive: boolean;
        grantedAt: Date;
        grantedBy: string;
        revokedAt?: Date;
        revokedBy?: string;
    }>;
    preferences: {
        timezone?: string;
        currency?: string;
        language?: string;
        emailNotifications: boolean;
        securityAlerts: boolean;
    };
    securityMetadata: {
        lastPasswordChange?: Date;
        mfaEnabled: boolean;
        lastSecurityReview?: Date;
        failedLoginAttempts: number;
        lockedUntil?: Date;
    };
    createdAt: Date;
    updatedAt: Date;
}
declare module 'mongoose' {
    interface Document {
        hasBusinessAccess?(businessId: string): boolean;
        getBusinessRole?(businessId: string): UserRole | null;
        getBusinessPermissions?(businessId: string): string[];
        addBusinessAccess?(businessId: string, role: UserRole, permissions: string[], grantedBy: string): void;
        revokeBusinessAccess?(businessId: string, revokedBy: string): void;
    }
}
declare const _default: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser> & IUser & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default _default;
//# sourceMappingURL=User.d.ts.map
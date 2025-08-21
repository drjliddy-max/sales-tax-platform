import mongoose, { Document } from 'mongoose';
import { UserRole } from '@/services/auth/Auth0Service';
export interface IUserInvitation extends Document {
    email: string;
    businessId: string;
    role: UserRole;
    permissions: string[];
    invitedBy: string;
    invitationToken: string;
    status: 'pending' | 'accepted' | 'expired' | 'revoked';
    expiresAt: Date;
    acceptedAt?: Date;
    revokedAt?: Date;
    revokedBy?: string;
    metadata: {
        ipAddress?: string;
        userAgent?: string;
        invitationMessage?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}
declare module 'mongoose' {
    interface Document {
        isExpired?(): boolean;
        canBeAccepted?(): boolean;
        accept?(acceptedBy?: string): void;
        revoke?(revokedBy: string, reason?: string): void;
    }
}
declare const _default: mongoose.Model<IUserInvitation, {}, {}, {}, mongoose.Document<unknown, {}, IUserInvitation> & IUserInvitation & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default _default;
//# sourceMappingURL=UserInvitation.d.ts.map
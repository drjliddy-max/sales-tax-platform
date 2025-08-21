import mongoose, { Document } from 'mongoose';
export interface IReportPermission extends Document {
    reportId: mongoose.Types.ObjectId;
    reportType: 'template' | 'dashboard';
    userId: mongoose.Types.ObjectId;
    permissionLevel: 'view' | 'edit' | 'admin';
    grantedBy?: mongoose.Types.ObjectId;
    grantedAt: Date;
}
export declare const ReportPermission: mongoose.Model<IReportPermission, {}, {}, {}, mongoose.Document<unknown, {}, IReportPermission> & IReportPermission & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=ReportPermission.d.ts.map
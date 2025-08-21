import mongoose, { Document } from 'mongoose';
export interface ICustomDashboard extends Document {
    name: string;
    description?: string;
    layoutConfig: {
        widgets: Array<{
            id: string;
            type: string;
            position: {
                x: number;
                y: number;
            };
            size: {
                width: number;
                height: number;
            };
            config: Record<string, any>;
        }>;
        layout: Record<string, any>;
    };
    filters: Record<string, any>;
    isDefault: boolean;
    isShared: boolean;
    createdBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export declare const CustomDashboard: mongoose.Model<ICustomDashboard, {}, {}, {}, mongoose.Document<unknown, {}, ICustomDashboard> & ICustomDashboard & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=CustomDashboard.d.ts.map
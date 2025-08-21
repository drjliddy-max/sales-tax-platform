import mongoose, { Document } from 'mongoose';
export interface IClient extends Document {
    name: string;
    email: string;
    currentTierId?: mongoose.Types.ObjectId;
    status: 'active' | 'inactive' | 'suspended';
    signupDate: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Client: mongoose.Model<IClient, {}, {}, {}, mongoose.Document<unknown, {}, IClient> & IClient & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=Client.d.ts.map
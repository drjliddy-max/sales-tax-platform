import mongoose, { Document } from 'mongoose';
export interface IChurnEvent extends Document {
    clientId: mongoose.Types.ObjectId;
    churnDate: Date;
    churnReason?: string;
    mrrLost: number;
    arrLost: number;
    daysAsCustomer: number;
    tierAtChurn: string;
    createdAt: Date;
}
export declare const ChurnEvent: mongoose.Model<IChurnEvent, {}, {}, {}, mongoose.Document<unknown, {}, IChurnEvent> & IChurnEvent & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=ChurnEvent.d.ts.map
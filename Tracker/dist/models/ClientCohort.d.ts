import mongoose, { Document } from 'mongoose';
export interface IClientCohort extends Document {
    clientId: mongoose.Types.ObjectId;
    cohortMonth: Date;
    cohortSize: number;
    createdAt: Date;
}
export declare const ClientCohort: mongoose.Model<IClientCohort, {}, {}, {}, mongoose.Document<unknown, {}, IClientCohort> & IClientCohort & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=ClientCohort.d.ts.map
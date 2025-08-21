import { ReportProcessor } from '../reporting/ReportProcessor';
export declare class ReportProcessorInitializer {
    private static instance;
    private initialized;
    private constructor();
    static getInstance(): ReportProcessorInitializer;
    initialize(): Promise<void>;
    getProcessor(): ReportProcessor;
    isInitialized(): boolean;
    shutdown(): Promise<void>;
    private setupGracefulShutdown;
}
export declare const reportProcessorInitializer: ReportProcessorInitializer;
//# sourceMappingURL=ReportProcessorInitializer.d.ts.map
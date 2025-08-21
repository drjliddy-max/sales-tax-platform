export declare class RevenueService {
    static initializeSampleData(): Promise<void>;
    static getAdminRevenueTransactions(): Promise<any[]>;
    static getRevenueMetrics(): Promise<{
        mrr: number;
        arr: number;
        totalClients: number;
        activeSubscriptions: number;
    }>;
}
//# sourceMappingURL=RevenueService.d.ts.map
export interface SquarePayment {
    id: string;
    amount_money: {
        amount: number;
        currency: string;
    };
    status: string;
    source_type: string;
    location_id: string;
    created_at: string;
    updated_at: string;
    receipt_number?: string;
    receipt_url?: string;
}
export declare class SquareIntegration {
    private baseUrl;
    private accessToken;
    private taxCalculator;
    constructor();
    syncPayments(locationId: string, startDate?: Date, endDate?: Date): Promise<void>;
    private processPayment;
    private getOrderDetails;
    private mapSquareStatus;
    testConnection(): Promise<boolean>;
}
//# sourceMappingURL=SquareIntegration.d.ts.map
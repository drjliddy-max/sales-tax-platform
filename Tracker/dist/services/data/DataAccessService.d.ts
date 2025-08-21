import type { User } from '@prisma/client';
export declare class DataAccessService {
    static getAccessibleBusinesses(user: User): Promise<string[]>;
    static canAccessBusiness(user: User, businessId: string): Promise<boolean>;
    static getTransactions(user: User, filters?: {
        businessId?: string;
        startDate?: Date;
        endDate?: Date;
        status?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        transactions: ({
            business: {
                id: string;
                name: string;
                industry: string | null;
            };
        } & {
            id: string;
            status: string;
            businessId: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            currency: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string | null;
            externalId: string | null;
            taxAmount: import("@prisma/client/runtime/library").Decimal;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            federalTax: import("@prisma/client/runtime/library").Decimal | null;
            stateTax: import("@prisma/client/runtime/library").Decimal | null;
            countyTax: import("@prisma/client/runtime/library").Decimal | null;
            cityTax: import("@prisma/client/runtime/library").Decimal | null;
            specialDistrictTax: import("@prisma/client/runtime/library").Decimal | null;
            description: string | null;
            productCategory: string | null;
            customerType: string;
            isExempt: boolean;
            exemptionReason: string | null;
            saleLocation: string;
            customerLocation: string | null;
            paymentMethod: string | null;
            posSource: string | null;
            transactionDate: Date;
            originalTransactionId: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
        pages: number;
    }>;
    static getReports(user: User, filters?: {
        businessId?: string;
        type?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        reports: ({
            business: {
                id: string;
                name: string;
            };
        } & {
            id: string;
            status: string;
            businessId: string;
            type: string;
            name: string;
            startDate: Date;
            endDate: Date;
            createdAt: Date;
            updatedAt: Date;
            totalAmount: import("@prisma/client/runtime/library").Decimal | null;
            period: string;
            fileUrl: string | null;
            fileFormat: string | null;
            totalTransactions: number | null;
            totalTax: import("@prisma/client/runtime/library").Decimal | null;
            generatedAt: Date | null;
        })[];
        total: number;
        page: number;
        limit: number;
        pages: number;
    }>;
    static getBusinessMetrics(user: User, businessId?: string, period?: 'day' | 'week' | 'month' | 'year'): Promise<{
        totalTransactions: number;
        totalRevenue: number | import("@prisma/client/runtime/library").Decimal;
        totalTax: number | import("@prisma/client/runtime/library").Decimal;
        trends: {
            date: Date;
            transactions: number;
            revenue: number | import("@prisma/client/runtime/library").Decimal;
            tax: number | import("@prisma/client/runtime/library").Decimal;
        }[];
    }>;
    static getClientStatistics(user: User): Promise<{
        clients: {
            total: number;
            active: number;
        };
        businesses: {
            total: number;
            active: number;
        };
        transactions: {
            total: number;
            last30Days: number;
        };
    }>;
    static verifyResourceAccess(user: User, resourceType: 'business' | 'transaction' | 'report', resourceId: string): Promise<boolean>;
}
export default DataAccessService;
//# sourceMappingURL=DataAccessService.d.ts.map
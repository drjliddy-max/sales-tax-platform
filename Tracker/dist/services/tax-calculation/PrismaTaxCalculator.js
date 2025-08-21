"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaTaxCalculator = void 0;
const prisma_1 = __importDefault(require("@/lib/prisma"));
class PrismaTaxCalculator {
    async calculateTax(request) {
        try {
            const business = await prisma_1.default.business.findUnique({
                where: { id: request.businessId },
                select: { nexusStates: true, state: true }
            });
            if (!business) {
                throw new Error('Business not found');
            }
            if (request.customerType === 'EXEMPT') {
                return this.createExemptBreakdown();
            }
            const saleState = this.extractStateFromLocation(request.saleLocation);
            const hasNexus = business.nexusStates.includes(saleState) || business.state === saleState;
            if (!hasNexus) {
                return this.createExemptBreakdown();
            }
            const taxRates = await this.getApplicableTaxRates(request.saleLocation, request.productCategory, request.transactionDate || new Date());
            const breakdown = this.calculateTaxBreakdown(request.amount, taxRates);
            return breakdown;
        }
        catch (error) {
            console.error('Tax calculation error:', error);
            throw new Error('Failed to calculate tax');
        }
    }
    async getApplicableTaxRates(location, productCategory, transactionDate = new Date()) {
        const locationParts = this.parseLocation(location);
        return await prisma_1.default.taxRate.findMany({
            where: {
                isActive: true,
                effectiveDate: { lte: transactionDate },
                OR: [
                    { expirationDate: null },
                    { expirationDate: { gte: transactionDate } }
                ],
                AND: [
                    {
                        OR: [
                            { jurisdictionCode: locationParts.state },
                            { jurisdictionCode: locationParts.county },
                            { jurisdictionCode: locationParts.city },
                            { jurisdiction: 'Federal' }
                        ]
                    },
                    {
                        OR: [
                            { productCategories: { isEmpty: true } },
                            { productCategories: { has: productCategory || 'GENERAL' } }
                        ]
                    }
                ]
            },
            orderBy: [
                { jurisdiction: 'asc' },
                { rate: 'desc' }
            ]
        });
    }
    calculateTaxBreakdown(amount, taxRates) {
        let federalTax = 0;
        let stateTax = 0;
        let countyTax = 0;
        let cityTax = 0;
        let specialDistrictTax = 0;
        const jurisdictions = [];
        for (const rate of taxRates) {
            const taxAmount = amount * parseFloat(rate.rate.toString());
            const jurisdictionTax = {
                jurisdiction: rate.jurisdiction,
                jurisdictionCode: rate.jurisdictionCode,
                taxType: rate.taxType,
                rate: parseFloat(rate.rate.toString()),
                amount: taxAmount,
                description: rate.description
            };
            jurisdictions.push(jurisdictionTax);
            switch (rate.jurisdiction.toLowerCase()) {
                case 'federal':
                    federalTax += taxAmount;
                    break;
                case 'state':
                    stateTax += taxAmount;
                    break;
                case 'county':
                    countyTax += taxAmount;
                    break;
                case 'city':
                    cityTax += taxAmount;
                    break;
                case 'special district':
                    specialDistrictTax += taxAmount;
                    break;
                default:
                    specialDistrictTax += taxAmount;
            }
        }
        const totalTax = federalTax + stateTax + countyTax + cityTax + specialDistrictTax;
        const effectiveRate = amount > 0 ? totalTax / amount : 0;
        return {
            federalTax: Math.round(federalTax * 10000) / 10000,
            stateTax: Math.round(stateTax * 10000) / 10000,
            countyTax: Math.round(countyTax * 10000) / 10000,
            cityTax: Math.round(cityTax * 10000) / 10000,
            specialDistrictTax: Math.round(specialDistrictTax * 10000) / 10000,
            totalTax: Math.round(totalTax * 100) / 100,
            effectiveRate: Math.round(effectiveRate * 1000000) / 1000000,
            jurisdictions
        };
    }
    createExemptBreakdown() {
        return {
            federalTax: 0,
            stateTax: 0,
            countyTax: 0,
            cityTax: 0,
            specialDistrictTax: 0,
            totalTax: 0,
            effectiveRate: 0,
            jurisdictions: []
        };
    }
    parseLocation(location) {
        const parts = location.split(',').map(p => p.trim());
        return {
            city: parts[0] || '',
            state: parts[1] || '',
            county: parts[2] || '',
            country: parts[3] || 'US'
        };
    }
    extractStateFromLocation(location) {
        const locationParts = this.parseLocation(location);
        return locationParts.state;
    }
    async hasNexus(businessId, state) {
        const business = await prisma_1.default.business.findUnique({
            where: { id: businessId },
            select: { nexusStates: true, state: true }
        });
        if (!business)
            return false;
        return business.nexusStates.includes(state) || business.state === state;
    }
    async getTaxRatesForLocation(location, productCategory) {
        const transactionDate = new Date();
        return await this.getApplicableTaxRates(location, productCategory, transactionDate);
    }
    async validateCalculation(request, expectedTotal) {
        const breakdown = await this.calculateTax(request);
        const calculatedTotal = request.amount + breakdown.totalTax;
        const tolerance = 0.01;
        return Math.abs(calculatedTotal - expectedTotal) <= tolerance;
    }
}
exports.PrismaTaxCalculator = PrismaTaxCalculator;
//# sourceMappingURL=PrismaTaxCalculator.js.map
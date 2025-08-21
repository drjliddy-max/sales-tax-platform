"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const prisma_1 = __importDefault(require("@/lib/prisma"));
const PrismaTaxCalculator_1 = require("@/services/tax-calculation/PrismaTaxCalculator");
const router = express_1.default.Router();
const taxCalculator = new PrismaTaxCalculator_1.PrismaTaxCalculator();
const calculateTaxSchema = joi_1.default.object({
    businessId: joi_1.default.string().required(),
    amount: joi_1.default.number().positive().required(),
    saleLocation: joi_1.default.string().required(),
    customerLocation: joi_1.default.string().optional(),
    productCategory: joi_1.default.string().optional(),
    customerType: joi_1.default.string().valid('RETAIL', 'WHOLESALE', 'EXEMPT').default('RETAIL'),
    exemptionReason: joi_1.default.string().optional(),
    transactionDate: joi_1.default.date().default(() => new Date())
});
const manageTaxRateSchema = joi_1.default.object({
    businessId: joi_1.default.string().optional(),
    jurisdiction: joi_1.default.string().required(),
    jurisdictionCode: joi_1.default.string().required(),
    taxType: joi_1.default.string().required(),
    rate: joi_1.default.number().min(0).max(1).required(),
    productCategories: joi_1.default.array().items(joi_1.default.string()).default([]),
    effectiveDate: joi_1.default.date().required(),
    expirationDate: joi_1.default.date().optional(),
    description: joi_1.default.string().optional()
});
router.post('/calculate', async (req, res) => {
    try {
        const { error, value } = calculateTaxSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            include: {
                businesses: {
                    where: { id: value.businessId, isActive: true }
                }
            }
        });
        if (!user || user.businesses.length === 0) {
            return res.status(403).json({ error: 'Access denied to this business' });
        }
        const taxBreakdown = await taxCalculator.calculateTax(value);
        res.json({
            amount: value.amount,
            taxBreakdown,
            totalAmount: value.amount + taxBreakdown.totalTax,
            calculation: {
                businessId: value.businessId,
                saleLocation: value.saleLocation,
                customerType: value.customerType,
                calculatedAt: new Date()
            }
        });
    }
    catch (error) {
        console.error('Error calculating tax:', error);
        res.status(500).json({ error: 'Failed to calculate tax' });
    }
});
router.get('/rates/:state', async (req, res) => {
    try {
        const { state } = req.params;
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const rates = await prisma_1.default.taxRate.findMany({
            where: {
                jurisdictionCode: state.toUpperCase(),
                isActive: true,
                businessId: null
            },
            orderBy: [
                { jurisdiction: 'asc' },
                { rate: 'desc' }
            ]
        });
        res.json({
            state: state.toUpperCase(),
            rates: rates.map(rate => ({
                id: rate.id,
                jurisdiction: rate.jurisdiction,
                jurisdictionCode: rate.jurisdictionCode,
                taxType: rate.taxType,
                rate: parseFloat(rate.rate.toString()),
                productCategories: rate.productCategories,
                effectiveDate: rate.effectiveDate,
                expirationDate: rate.expirationDate,
                description: rate.description
            }))
        });
    }
    catch (error) {
        console.error('Error fetching tax rates:', error);
        res.status(500).json({ error: 'Failed to fetch tax rates' });
    }
});
router.get('/rates/location', async (req, res) => {
    try {
        const { location, productCategory } = req.query;
        const clerkUserId = req.auth.userId;
        if (!location) {
            return res.status(400).json({ error: 'Location parameter is required' });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const rates = await taxCalculator.getTaxRatesForLocation(location, productCategory);
        res.json({
            location,
            productCategory: productCategory || 'ALL',
            rates: rates.map(rate => ({
                id: rate.id,
                jurisdiction: rate.jurisdiction,
                jurisdictionCode: rate.jurisdictionCode,
                taxType: rate.taxType,
                rate: parseFloat(rate.rate.toString()),
                productCategories: rate.productCategories,
                effectiveDate: rate.effectiveDate,
                expirationDate: rate.expirationDate,
                description: rate.description
            }))
        });
    }
    catch (error) {
        console.error('Error fetching location tax rates:', error);
        res.status(500).json({ error: 'Failed to fetch location tax rates' });
    }
});
router.post('/rates', async (req, res) => {
    try {
        const { error, value } = manageTaxRateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const clerkUserId = req.auth.userId;
        if (value.businessId) {
            const user = await prisma_1.default.user.findUnique({
                where: { clerkUserId },
                include: {
                    businesses: {
                        where: { id: value.businessId, isActive: true }
                    }
                }
            });
            if (!user || user.businesses.length === 0) {
                return res.status(403).json({ error: 'Access denied to this business' });
            }
        }
        else {
            return res.status(403).json({ error: 'Business ID is required for custom tax rates' });
        }
        const taxRate = await prisma_1.default.taxRate.create({
            data: value
        });
        res.status(201).json({
            id: taxRate.id,
            jurisdiction: taxRate.jurisdiction,
            jurisdictionCode: taxRate.jurisdictionCode,
            taxType: taxRate.taxType,
            rate: parseFloat(taxRate.rate.toString()),
            productCategories: taxRate.productCategories,
            effectiveDate: taxRate.effectiveDate,
            expirationDate: taxRate.expirationDate,
            description: taxRate.description,
            businessId: taxRate.businessId
        });
    }
    catch (error) {
        console.error('Error creating tax rate:', error);
        res.status(500).json({ error: 'Failed to create tax rate' });
    }
});
router.get('/nexus/:businessId', async (req, res) => {
    try {
        const { businessId } = req.params;
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            include: {
                businesses: {
                    where: { id: businessId, isActive: true }
                }
            }
        });
        if (!user || user.businesses.length === 0) {
            return res.status(403).json({ error: 'Access denied to this business' });
        }
        const business = user.businesses[0];
        const nexusDetails = await Promise.all(business.nexusStates.map(async (state) => {
            const jurisdictions = await prisma_1.default.taxJurisdiction.findMany({
                where: {
                    code: state,
                    isActive: true
                }
            });
            const hasNexus = await taxCalculator.hasNexus(businessId, state);
            return {
                state,
                hasNexus,
                jurisdictions: jurisdictions.map(j => ({
                    name: j.name,
                    type: j.type,
                    filingFrequency: j.filingFrequency,
                    dueDate: j.dueDate,
                    thresholdAmount: j.thresholdAmount ? parseFloat(j.thresholdAmount.toString()) : null
                }))
            };
        }));
        res.json({
            businessId,
            businessName: business.name,
            nexusStates: nexusDetails
        });
    }
    catch (error) {
        console.error('Error fetching nexus information:', error);
        res.status(500).json({ error: 'Failed to fetch nexus information' });
    }
});
router.patch('/nexus/:businessId', async (req, res) => {
    try {
        const { businessId } = req.params;
        const { nexusStates } = req.body;
        const clerkUserId = req.auth.userId;
        if (!Array.isArray(nexusStates)) {
            return res.status(400).json({ error: 'nexusStates must be an array' });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const business = await prisma_1.default.business.findUnique({
            where: {
                id: businessId,
                ownerId: user.id
            }
        });
        if (!business) {
            return res.status(404).json({ error: 'Business not found' });
        }
        const updatedNexusStates = [...new Set([...nexusStates, business.state])];
        const updatedBusiness = await prisma_1.default.business.update({
            where: { id: businessId },
            data: {
                nexusStates: updatedNexusStates
            }
        });
        await prisma_1.default.auditLog.create({
            data: {
                action: 'UPDATE',
                entityType: 'BUSINESS_NEXUS',
                entityId: businessId,
                oldValues: { nexusStates: business.nexusStates },
                newValues: { nexusStates: updatedNexusStates },
                userId: user.id,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        });
        res.json({
            businessId,
            nexusStates: updatedBusiness.nexusStates
        });
    }
    catch (error) {
        console.error('Error updating nexus states:', error);
        res.status(500).json({ error: 'Failed to update nexus states' });
    }
});
exports.default = router;
//# sourceMappingURL=tax.js.map
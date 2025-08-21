"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const prisma_1 = __importDefault(require("@/lib/prisma"));
const router = express_1.default.Router();
const createBusinessSchema = joi_1.default.object({
    name: joi_1.default.string().min(1).max(255).required(),
    taxId: joi_1.default.string().optional(),
    address: joi_1.default.string().required(),
    city: joi_1.default.string().required(),
    state: joi_1.default.string().length(2).required(),
    zipCode: joi_1.default.string().required(),
    country: joi_1.default.string().default('US'),
    phone: joi_1.default.string().optional(),
    email: joi_1.default.string().email().optional(),
    website: joi_1.default.string().uri().optional(),
    industry: joi_1.default.string().optional(),
    businessType: joi_1.default.string().valid('LLC', 'Corporation', 'Partnership', 'Sole Proprietorship').default('LLC'),
    nexusStates: joi_1.default.array().items(joi_1.default.string().length(2)).default([])
});
const updateBusinessSchema = joi_1.default.object({
    name: joi_1.default.string().min(1).max(255).optional(),
    taxId: joi_1.default.string().optional(),
    address: joi_1.default.string().optional(),
    city: joi_1.default.string().optional(),
    state: joi_1.default.string().length(2).optional(),
    zipCode: joi_1.default.string().optional(),
    country: joi_1.default.string().optional(),
    phone: joi_1.default.string().optional(),
    email: joi_1.default.string().email().optional(),
    website: joi_1.default.string().uri().optional(),
    industry: joi_1.default.string().optional(),
    businessType: joi_1.default.string().valid('LLC', 'Corporation', 'Partnership', 'Sole Proprietorship').optional(),
    nexusStates: joi_1.default.array().items(joi_1.default.string().length(2)).optional(),
    isActive: joi_1.default.boolean().optional()
});
router.get('/', async (req, res) => {
    try {
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            include: {
                businesses: {
                    where: { isActive: true },
                    include: {
                        _count: {
                            select: {
                                transactions: true,
                                posIntegrations: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user.businesses);
    }
    catch (error) {
        console.error('Error fetching businesses:', error);
        res.status(500).json({ error: 'Failed to fetch businesses' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const business = await prisma_1.default.business.findUnique({
            where: {
                id: req.params.id,
                ownerId: user.id,
                isActive: true
            },
            include: {
                _count: {
                    select: {
                        transactions: true,
                        posIntegrations: true,
                        reports: true
                    }
                },
                posIntegrations: {
                    select: {
                        id: true,
                        provider: true,
                        isActive: true,
                        lastSyncAt: true,
                        syncStatus: true
                    }
                }
            }
        });
        if (!business) {
            return res.status(404).json({ error: 'Business not found' });
        }
        res.json(business);
    }
    catch (error) {
        console.error('Error fetching business:', error);
        res.status(500).json({ error: 'Failed to fetch business' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { error, value } = createBusinessSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const nexusStates = [...new Set([...value.nexusStates, value.state])];
        const business = await prisma_1.default.business.create({
            data: {
                ...value,
                nexusStates,
                ownerId: user.id
            },
            include: {
                _count: {
                    select: {
                        transactions: true,
                        posIntegrations: true
                    }
                }
            }
        });
        await prisma_1.default.auditLog.create({
            data: {
                action: 'CREATE',
                entityType: 'BUSINESS',
                entityId: business.id,
                newValues: business,
                userId: user.id,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        });
        res.status(201).json(business);
    }
    catch (error) {
        console.error('Error creating business:', error);
        res.status(500).json({ error: 'Failed to create business' });
    }
});
router.patch('/:id', async (req, res) => {
    try {
        const { error, value } = updateBusinessSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const existingBusiness = await prisma_1.default.business.findUnique({
            where: {
                id: req.params.id,
                ownerId: user.id
            }
        });
        if (!existingBusiness) {
            return res.status(404).json({ error: 'Business not found' });
        }
        let nexusStates = value.nexusStates;
        if (value.state && value.nexusStates) {
            nexusStates = [...new Set([...value.nexusStates, value.state])];
        }
        const business = await prisma_1.default.business.update({
            where: { id: req.params.id },
            data: {
                ...value,
                ...(nexusStates && { nexusStates })
            },
            include: {
                _count: {
                    select: {
                        transactions: true,
                        posIntegrations: true
                    }
                }
            }
        });
        await prisma_1.default.auditLog.create({
            data: {
                action: 'UPDATE',
                entityType: 'BUSINESS',
                entityId: business.id,
                oldValues: existingBusiness,
                newValues: value,
                userId: user.id,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        });
        res.json(business);
    }
    catch (error) {
        console.error('Error updating business:', error);
        res.status(500).json({ error: 'Failed to update business' });
    }
});
exports.default = router;
//# sourceMappingURL=business.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const prisma_1 = __importDefault(require("@/lib/prisma"));
const clerk_1 = require("@/middleware/clerk");
const router = express_1.default.Router();
router.use(clerk_1.requireAuth);
const createTenantSchema = joi_1.default.object({
    name: joi_1.default.string().min(1).max(255).required(),
    slug: joi_1.default.string().min(1).max(100).pattern(/^[a-z0-9-]+$/).required(),
    domain: joi_1.default.string().optional(),
    plan: joi_1.default.string().valid('starter', 'professional', 'enterprise').default('starter'),
    settings: joi_1.default.object().optional(),
    billing: joi_1.default.object().optional(),
    limits: joi_1.default.object().optional()
});
const updateTenantSchema = joi_1.default.object({
    name: joi_1.default.string().min(1).max(255).optional(),
    domain: joi_1.default.string().optional(),
    status: joi_1.default.string().valid('active', 'suspended', 'deleted').optional(),
    plan: joi_1.default.string().valid('starter', 'professional', 'enterprise').optional(),
    settings: joi_1.default.object().optional(),
    billing: joi_1.default.object().optional(),
    limits: joi_1.default.object().optional()
});
const tenantUserSchema = joi_1.default.object({
    userId: joi_1.default.string().required(),
    role: joi_1.default.string().valid('owner', 'admin', 'manager', 'user', 'viewer').required(),
    permissions: joi_1.default.array().items(joi_1.default.string()).optional()
});
const invitationSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    role: joi_1.default.string().valid('admin', 'manager', 'user', 'viewer').required(),
    permissions: joi_1.default.array().items(joi_1.default.string()).optional()
});
router.post('/', async (req, res) => {
    try {
        const { error, value } = createTenantSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const existingTenant = await prisma_1.default.tenant.findUnique({
            where: { slug: value.slug }
        });
        if (existingTenant) {
            return res.status(400).json({
                success: false,
                error: 'Tenant slug already exists'
            });
        }
        const tenant = await prisma_1.default.tenant.create({
            data: {
                ...value,
                ownerId: req.user.id
            },
            include: {
                owner: true,
                tenantUsers: true,
                _count: {
                    select: {
                        businesses: true,
                        transactions: true,
                        reports: true
                    }
                }
            }
        });
        await prisma_1.default.tenantUser.create({
            data: {
                tenantId: tenant.id,
                userId: req.user.id,
                role: 'owner',
                permissions: [],
                isActive: true,
                joinedAt: new Date()
            }
        });
        res.status(201).json({
            success: true,
            data: tenant
        });
    }
    catch (error) {
        console.error('Error creating tenant:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create tenant'
        });
    }
});
router.get('/user-access', async (req, res) => {
    try {
        const tenantUsers = await prisma_1.default.tenantUser.findMany({
            where: {
                userId: req.user.id,
                isActive: true
            },
            include: {
                tenant: {
                    include: {
                        _count: {
                            select: {
                                businesses: true,
                                transactions: true,
                                reports: true
                            }
                        }
                    }
                }
            }
        });
        const userAccess = tenantUsers.map(tu => ({
            tenantId: tu.tenantId,
            tenant: tu.tenant,
            role: tu.role,
            permissions: tu.permissions,
            joinedAt: tu.joinedAt,
            isPrimary: tu.tenant.ownerId === req.user.id
        }));
        res.json({
            success: true,
            data: userAccess
        });
    }
    catch (error) {
        console.error('Error fetching user tenants:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user tenants'
        });
    }
});
router.get('/:id/details', async (req, res) => {
    try {
        const tenantId = req.params.id;
        const tenantUser = await prisma_1.default.tenantUser.findUnique({
            where: {
                tenantId_userId: {
                    tenantId,
                    userId: req.user.id
                }
            }
        });
        if (!tenantUser || !tenantUser.isActive) {
            return res.status(403).json({
                success: false,
                error: 'Access denied to this tenant'
            });
        }
        const tenant = await prisma_1.default.tenant.findUnique({
            where: { id: tenantId },
            include: {
                owner: true,
                tenantUsers: {
                    include: {
                        user: true
                    }
                },
                _count: {
                    select: {
                        businesses: true,
                        transactions: true,
                        reports: true,
                        backups: true
                    }
                }
            }
        });
        if (!tenant) {
            return res.status(404).json({
                success: false,
                error: 'Tenant not found'
            });
        }
        res.json({
            success: true,
            data: {
                ...tenant,
                userRole: tenantUser.role,
                userPermissions: tenantUser.permissions
            }
        });
    }
    catch (error) {
        console.error('Error fetching tenant details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch tenant details'
        });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const tenantId = req.params.id;
        const tenantUser = await prisma_1.default.tenantUser.findUnique({
            where: {
                tenantId_userId: {
                    tenantId,
                    userId: req.user.id
                }
            }
        });
        if (!tenantUser || !['owner', 'admin'].includes(tenantUser.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions to update tenant'
            });
        }
        const { error, value } = updateTenantSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const tenant = await prisma_1.default.tenant.update({
            where: { id: tenantId },
            data: value,
            include: {
                owner: true,
                _count: {
                    select: {
                        businesses: true,
                        transactions: true,
                        reports: true
                    }
                }
            }
        });
        res.json({
            success: true,
            data: tenant
        });
    }
    catch (error) {
        console.error('Error updating tenant:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update tenant'
        });
    }
});
router.post('/switch', async (req, res) => {
    try {
        const { tenantId } = req.body;
        if (!tenantId) {
            return res.status(400).json({
                success: false,
                error: 'tenantId is required'
            });
        }
        const tenantUser = await prisma_1.default.tenantUser.findUnique({
            where: {
                tenantId_userId: {
                    tenantId,
                    userId: req.user.id
                }
            },
            include: {
                tenant: true
            }
        });
        if (!tenantUser || !tenantUser.isActive) {
            return res.status(403).json({
                success: false,
                error: 'Access denied to this tenant'
            });
        }
        res.json({
            success: true,
            data: {
                tenant: tenantUser.tenant,
                role: tenantUser.role,
                permissions: tenantUser.permissions
            }
        });
    }
    catch (error) {
        console.error('Error switching tenant:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to switch tenant'
        });
    }
});
router.get('/:id/users', async (req, res) => {
    try {
        const tenantId = req.params.id;
        const tenantUser = await prisma_1.default.tenantUser.findUnique({
            where: {
                tenantId_userId: {
                    tenantId,
                    userId: req.user.id
                }
            }
        });
        if (!tenantUser || !['owner', 'admin', 'manager'].includes(tenantUser.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions to view users'
            });
        }
        const users = await prisma_1.default.tenantUser.findMany({
            where: { tenantId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        profileImageUrl: true,
                        lastLoginAt: true
                    }
                }
            }
        });
        res.json({
            success: true,
            data: users
        });
    }
    catch (error) {
        console.error('Error fetching tenant users:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch tenant users'
        });
    }
});
router.post('/:id/users', async (req, res) => {
    try {
        const tenantId = req.params.id;
        const tenantUser = await prisma_1.default.tenantUser.findUnique({
            where: {
                tenantId_userId: {
                    tenantId,
                    userId: req.user.id
                }
            }
        });
        if (!tenantUser || !['owner', 'admin'].includes(tenantUser.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions to add users'
            });
        }
        const { error, value } = tenantUserSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: value.userId }
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        const newTenantUser = await prisma_1.default.tenantUser.create({
            data: {
                tenantId,
                userId: value.userId,
                role: value.role,
                permissions: value.permissions || [],
                isActive: true,
                joinedAt: new Date()
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        profileImageUrl: true
                    }
                }
            }
        });
        res.status(201).json({
            success: true,
            data: newTenantUser
        });
    }
    catch (error) {
        console.error('Error adding user to tenant:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add user to tenant'
        });
    }
});
router.put('/:id/users/:userId', async (req, res) => {
    try {
        const { id: tenantId, userId } = req.params;
        const requestorTenantUser = await prisma_1.default.tenantUser.findUnique({
            where: {
                tenantId_userId: {
                    tenantId,
                    userId: req.user.id
                }
            }
        });
        if (!requestorTenantUser || !['owner', 'admin'].includes(requestorTenantUser.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions to update user roles'
            });
        }
        const { role, permissions } = req.body;
        if (!role || !['owner', 'admin', 'manager', 'user', 'viewer'].includes(role)) {
            return res.status(400).json({
                success: false,
                error: 'Valid role is required'
            });
        }
        if (role === 'owner' && requestorTenantUser.role !== 'owner') {
            return res.status(403).json({
                success: false,
                error: 'Only owners can assign owner role'
            });
        }
        const updatedTenantUser = await prisma_1.default.tenantUser.update({
            where: {
                tenantId_userId: {
                    tenantId,
                    userId
                }
            },
            data: {
                role,
                permissions: permissions || []
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        profileImageUrl: true
                    }
                }
            }
        });
        res.json({
            success: true,
            data: updatedTenantUser
        });
    }
    catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update user role'
        });
    }
});
router.delete('/:id/users/:userId', async (req, res) => {
    try {
        const { id: tenantId, userId } = req.params;
        const requestorTenantUser = await prisma_1.default.tenantUser.findUnique({
            where: {
                tenantId_userId: {
                    tenantId,
                    userId: req.user.id
                }
            }
        });
        if (!requestorTenantUser || !['owner', 'admin'].includes(requestorTenantUser.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions to remove users'
            });
        }
        const targetTenantUser = await prisma_1.default.tenantUser.findUnique({
            where: {
                tenantId_userId: {
                    tenantId,
                    userId
                }
            }
        });
        if (targetTenantUser?.role === 'owner') {
            return res.status(400).json({
                success: false,
                error: 'Cannot remove tenant owner'
            });
        }
        await prisma_1.default.tenantUser.delete({
            where: {
                tenantId_userId: {
                    tenantId,
                    userId
                }
            }
        });
        res.json({
            success: true,
            data: { removed: true }
        });
    }
    catch (error) {
        console.error('Error removing user from tenant:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove user from tenant'
        });
    }
});
exports.default = router;
//# sourceMappingURL=tenants.js.map
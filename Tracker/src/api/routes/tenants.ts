import express from 'express';
import Joi from 'joi';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/middleware/clerk';
import { protectAdminRoute } from '@/middleware/auth';

const router = express.Router();

// Apply authentication to all tenant routes
router.use(requireAuth);

// Validation schemas
const createTenantSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  slug: Joi.string().min(1).max(100).pattern(/^[a-z0-9-]+$/).required(),
  domain: Joi.string().optional(),
  plan: Joi.string().valid('starter', 'professional', 'enterprise').default('starter'),
  settings: Joi.object().optional(),
  billing: Joi.object().optional(),
  limits: Joi.object().optional()
});

const updateTenantSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  domain: Joi.string().optional(),
  status: Joi.string().valid('active', 'suspended', 'deleted').optional(),
  plan: Joi.string().valid('starter', 'professional', 'enterprise').optional(),
  settings: Joi.object().optional(),
  billing: Joi.object().optional(),
  limits: Joi.object().optional()
});

const tenantUserSchema = Joi.object({
  userId: Joi.string().required(),
  role: Joi.string().valid('owner', 'admin', 'manager', 'user', 'viewer').required(),
  permissions: Joi.array().items(Joi.string()).optional()
});

const invitationSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid('admin', 'manager', 'user', 'viewer').required(),
  permissions: Joi.array().items(Joi.string()).optional()
});

// ==================
// TENANT CRUD ROUTES
// ==================

// POST /api/tenants - Create tenant
router.post('/', async (req, res) => {
  try {
    const { error, value } = createTenantSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    // Check if slug is unique
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: value.slug }
    });

    if (existingTenant) {
      return res.status(400).json({
        success: false,
        error: 'Tenant slug already exists'
      });
    }

    const tenant = await prisma.tenant.create({
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

    // Create the owner relationship
    await prisma.tenantUser.create({
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
  } catch (error) {
    console.error('Error creating tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create tenant'
    });
  }
});

// GET /api/tenants/user-access - Get user's accessible tenants
router.get('/user-access', async (req, res) => {
  try {
    const tenantUsers = await prisma.tenantUser.findMany({
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
  } catch (error) {
    console.error('Error fetching user tenants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user tenants'
    });
  }
});

// GET /api/tenants/:id/details - Get tenant details with user role
router.get('/:id/details', async (req, res) => {
  try {
    const tenantId = req.params.id;
    
    // Check if user has access to this tenant
    const tenantUser = await prisma.tenantUser.findUnique({
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

    const tenant = await prisma.tenant.findUnique({
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
  } catch (error) {
    console.error('Error fetching tenant details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tenant details'
    });
  }
});

// PUT /api/tenants/:id - Update tenant
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.params.id;
    
    // Check if user is owner or admin
    const tenantUser = await prisma.tenantUser.findUnique({
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

    const tenant = await prisma.tenant.update({
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
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update tenant'
    });
  }
});

// POST /api/tenants/switch - Switch active tenant
router.post('/switch', async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'tenantId is required'
      });
    }

    // Verify user has access to this tenant
    const tenantUser = await prisma.tenantUser.findUnique({
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
  } catch (error) {
    console.error('Error switching tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to switch tenant'
    });
  }
});

// ===================
// USER MANAGEMENT ROUTES
// ===================

// GET /api/tenants/:id/users - Get tenant users
router.get('/:id/users', async (req, res) => {
  try {
    const tenantId = req.params.id;
    
    // Check if user has permission to view users
    const tenantUser = await prisma.tenantUser.findUnique({
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

    const users = await prisma.tenantUser.findMany({
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
  } catch (error) {
    console.error('Error fetching tenant users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tenant users'
    });
  }
});

// POST /api/tenants/:id/users - Add user to tenant
router.post('/:id/users', async (req, res) => {
  try {
    const tenantId = req.params.id;
    
    // Check if user has permission to manage users
    const tenantUser = await prisma.tenantUser.findUnique({
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

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: value.userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Create tenant user relationship
    const newTenantUser = await prisma.tenantUser.create({
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
  } catch (error) {
    console.error('Error adding user to tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add user to tenant'
    });
  }
});

// PUT /api/tenants/:id/users/:userId - Update user role in tenant
router.put('/:id/users/:userId', async (req, res) => {
  try {
    const { id: tenantId, userId } = req.params;
    
    // Check if user has permission to manage users
    const requestorTenantUser = await prisma.tenantUser.findUnique({
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

    // Only owner can create other owners
    if (role === 'owner' && requestorTenantUser.role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: 'Only owners can assign owner role'
      });
    }

    const updatedTenantUser = await prisma.tenantUser.update({
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
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user role'
    });
  }
});

// DELETE /api/tenants/:id/users/:userId - Remove user from tenant
router.delete('/:id/users/:userId', async (req, res) => {
  try {
    const { id: tenantId, userId } = req.params;
    
    // Check if user has permission to manage users
    const requestorTenantUser = await prisma.tenantUser.findUnique({
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

    // Cannot remove the owner
    const targetTenantUser = await prisma.tenantUser.findUnique({
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

    await prisma.tenantUser.delete({
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
  } catch (error) {
    console.error('Error removing user from tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove user from tenant'
    });
  }
});

export default router;
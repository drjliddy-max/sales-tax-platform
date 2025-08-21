import express from 'express';
import Joi from 'joi';
import prisma from '@/lib/prisma';

const router = express.Router();

// Validation schemas
const createBusinessSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  taxId: Joi.string().optional(),
  address: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().length(2).required(),
  zipCode: Joi.string().required(),
  country: Joi.string().default('US'),
  phone: Joi.string().optional(),
  email: Joi.string().email().optional(),
  website: Joi.string().uri().optional(),
  industry: Joi.string().optional(),
  businessType: Joi.string().valid('LLC', 'Corporation', 'Partnership', 'Sole Proprietorship').default('LLC'),
  nexusStates: Joi.array().items(Joi.string().length(2)).default([])
});

const updateBusinessSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  taxId: Joi.string().optional(),
  address: Joi.string().optional(),
  city: Joi.string().optional(),
  state: Joi.string().length(2).optional(),
  zipCode: Joi.string().optional(),
  country: Joi.string().optional(),
  phone: Joi.string().optional(),
  email: Joi.string().email().optional(),
  website: Joi.string().uri().optional(),
  industry: Joi.string().optional(),
  businessType: Joi.string().valid('LLC', 'Corporation', 'Partnership', 'Sole Proprietorship').optional(),
  nexusStates: Joi.array().items(Joi.string().length(2)).optional(),
  isActive: Joi.boolean().optional()
});

// Get all user's businesses
router.get('/', async (req: any, res) => {
  try {
    const clerkUserId = req.auth.userId;
    
    const user = await prisma.user.findUnique({
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
  } catch (error) {
    console.error('Error fetching businesses:', error);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

// Get single business
router.get('/:id', async (req: any, res) => {
  try {
    const clerkUserId = req.auth.userId;
    
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const business = await prisma.business.findUnique({
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
  } catch (error) {
    console.error('Error fetching business:', error);
    res.status(500).json({ error: 'Failed to fetch business' });
  }
});

// Create new business
router.post('/', async (req: any, res) => {
  try {
    const { error, value } = createBusinessSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const clerkUserId = req.auth.userId;
    
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add business owner's state to nexus states
    const nexusStates = [...new Set([...value.nexusStates, value.state])];

    const business = await prisma.business.create({
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

    // Log audit event
    await prisma.auditLog.create({
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
  } catch (error) {
    console.error('Error creating business:', error);
    res.status(500).json({ error: 'Failed to create business' });
  }
});

// Update business
router.patch('/:id', async (req: any, res) => {
  try {
    const { error, value } = updateBusinessSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const clerkUserId = req.auth.userId;
    
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get existing business for audit log
    const existingBusiness = await prisma.business.findUnique({
      where: { 
        id: req.params.id,
        ownerId: user.id
      }
    });

    if (!existingBusiness) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Update nexus states if state changed
    let nexusStates = value.nexusStates;
    if (value.state && value.nexusStates) {
      nexusStates = [...new Set([...value.nexusStates, value.state])];
    }

    const business = await prisma.business.update({
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

    // Log audit event
    await prisma.auditLog.create({
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
  } catch (error) {
    console.error('Error updating business:', error);
    res.status(500).json({ error: 'Failed to update business' });
  }
});

export default router;
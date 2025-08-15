import express from 'express';
import Joi from 'joi';
import prisma from '@/lib/prisma';
import { PrismaTaxCalculator } from '@/services/tax-calculation/PrismaTaxCalculator';

const router = express.Router();
const taxCalculator = new PrismaTaxCalculator();

const calculateTaxSchema = Joi.object({
  businessId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  saleLocation: Joi.string().required(),
  customerLocation: Joi.string().optional(),
  productCategory: Joi.string().optional(),
  customerType: Joi.string().valid('RETAIL', 'WHOLESALE', 'EXEMPT').default('RETAIL'),
  exemptionReason: Joi.string().optional(),
  transactionDate: Joi.date().default(() => new Date())
});

const manageTaxRateSchema = Joi.object({
  businessId: Joi.string().optional(),
  jurisdiction: Joi.string().required(),
  jurisdictionCode: Joi.string().required(),
  taxType: Joi.string().required(),
  rate: Joi.number().min(0).max(1).required(),
  productCategories: Joi.array().items(Joi.string()).default([]),
  effectiveDate: Joi.date().required(),
  expirationDate: Joi.date().optional(),
  description: Joi.string().optional()
});

// Calculate tax for a transaction
router.post('/calculate', async (req: any, res) => {
  try {
    const { error, value } = calculateTaxSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const clerkUserId = req.auth.userId;
    
    // Verify business access
    const user = await prisma.user.findUnique({
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
  } catch (error) {
    console.error('Error calculating tax:', error);
    res.status(500).json({ error: 'Failed to calculate tax' });
  }
});

// Get tax rates for a state
router.get('/rates/:state', async (req: any, res) => {
  try {
    const { state } = req.params;
    const clerkUserId = req.auth.userId;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const rates = await prisma.taxRate.findMany({
      where: {
        jurisdictionCode: state.toUpperCase(),
        isActive: true,
        businessId: null // Only public rates
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
  } catch (error) {
    console.error('Error fetching tax rates:', error);
    res.status(500).json({ error: 'Failed to fetch tax rates' });
  }
});

// Get tax rates for a specific location
router.get('/rates/location', async (req: any, res) => {
  try {
    const { location, productCategory } = req.query;
    const clerkUserId = req.auth.userId;

    if (!location) {
      return res.status(400).json({ error: 'Location parameter is required' });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
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
  } catch (error) {
    console.error('Error fetching location tax rates:', error);
    res.status(500).json({ error: 'Failed to fetch location tax rates' });
  }
});

// Create custom tax rate for a business
router.post('/rates', async (req: any, res) => {
  try {
    const { error, value } = manageTaxRateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const clerkUserId = req.auth.userId;
    
    // Verify business access if businessId provided
    if (value.businessId) {
      const user = await prisma.user.findUnique({
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
    } else {
      // Only admins can create public tax rates
      // For now, we'll allow authenticated users to create business-specific rates
      return res.status(403).json({ error: 'Business ID is required for custom tax rates' });
    }

    const taxRate = await prisma.taxRate.create({
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
  } catch (error) {
    console.error('Error creating tax rate:', error);
    res.status(500).json({ error: 'Failed to create tax rate' });
  }
});

// Get nexus states for business
router.get('/nexus/:businessId', async (req: any, res) => {
  try {
    const { businessId } = req.params;
    const clerkUserId = req.auth.userId;
    
    // Verify business access
    const user = await prisma.user.findUnique({
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
    
    // Get tax obligations for each nexus state
    const nexusDetails = await Promise.all(
      business.nexusStates.map(async (state) => {
        const jurisdictions = await prisma.taxJurisdiction.findMany({
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
      })
    );

    res.json({
      businessId,
      businessName: business.name,
      nexusStates: nexusDetails
    });
  } catch (error) {
    console.error('Error fetching nexus information:', error);
    res.status(500).json({ error: 'Failed to fetch nexus information' });
  }
});

// Update business nexus states
router.patch('/nexus/:businessId', async (req: any, res) => {
  try {
    const { businessId } = req.params;
    const { nexusStates } = req.body;
    const clerkUserId = req.auth.userId;

    if (!Array.isArray(nexusStates)) {
      return res.status(400).json({ error: 'nexusStates must be an array' });
    }

    // Verify business access
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const business = await prisma.business.findUnique({
      where: {
        id: businessId,
        ownerId: user.id
      }
    });

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Ensure business state is included in nexus states
    const updatedNexusStates = [...new Set([...nexusStates, business.state])];

    const updatedBusiness = await prisma.business.update({
      where: { id: businessId },
      data: {
        nexusStates: updatedNexusStates
      }
    });

    // Log audit event
    await prisma.auditLog.create({
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
  } catch (error) {
    console.error('Error updating nexus states:', error);
    res.status(500).json({ error: 'Failed to update nexus states' });
  }
});

export default router;
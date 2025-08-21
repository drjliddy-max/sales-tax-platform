import { verifyToken } from '@clerk/backend'
import prisma from '@/lib/prisma'

export interface AuthRequest extends Request {
  auth: {
    userId: string
    sessionClaims?: any
  }
  user?: {
    id: string
    clerkUserId: string
    email: string
    firstName?: string
    lastName?: string
    role: string
    isActive: boolean
    businesses?: any[]
  }
}

export const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!
    });

    req.auth = payload;

    // Update user's last login time
    if (payload.userId) {
      await prisma.user.updateMany({
        where: { clerkUserId: payload.userId },
        data: { lastLoginAt: new Date() }
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid authorization token' });
  }
}

export const requireUser = async (req: any, res: any, next: any) => {
  try {
    const clerkUserId = req.auth.userId;
    
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        businesses: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'User account is disabled' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Failed to fetch user data' });
  }
}

export const requireAdmin = async (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(400).json({ error: 'User data not available' });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

export const requireClient = async (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(400).json({ error: 'User data not available' });
  }

  if (req.user.role !== 'CLIENT' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Client access required' });
  }

  next();
}

export const requireBusinessOwner = async (req: any, res: any, next: any) => {
  try {
    const businessId = req.params.businessId || req.body.businessId || req.query.businessId;
    
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID required' });
    }

    // Admin can access any business
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Check if user owns the business
    const business = await prisma.business.findFirst({
      where: {
        id: businessId,
        ownerId: req.user.id,
        isActive: true
      }
    });

    if (!business) {
      return res.status(403).json({ error: 'Access denied to this business' });
    }

    req.business = business;
    next();
  } catch (error) {
    console.error('Error checking business ownership:', error);
    return res.status(500).json({ error: 'Failed to verify business access' });
  }
}

// Combined middleware chains
export const protectRoute = [requireAuth, requireUser];
export const protectAdminRoute = [requireAuth, requireUser, requireAdmin];
export const protectClientRoute = [requireAuth, requireUser, requireClient];
export const protectBusinessRoute = [requireAuth, requireUser, requireBusinessOwner];

// Legacy support
export const protectRouteOld = (req: any, res: any, next: any) => {
  requireAuth(req, res, next);
}

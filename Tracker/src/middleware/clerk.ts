import { verifyToken } from '@clerk/backend'

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
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid authorization token' });
  }
}

export const protectRoute = (req: any, res: any, next: any) => {
  // Middleware to protect API routes
  requireAuth(req, res, next);
}

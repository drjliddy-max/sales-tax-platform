import express from 'express';
import { requireAuth } from '@/middleware/clerk';
import prisma from '@/lib/prisma';
import { WebhookEvent } from '@clerk/backend';

const router = express.Router();

// Webhook endpoint for Clerk user events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const headerPayload = req.headers;
    const svixHeaders = {
      'svix-id': headerPayload['svix-id'] as string,
      'svix-timestamp': headerPayload['svix-timestamp'] as string,
      'svix-signature': headerPayload['svix-signature'] as string,
    };

    const payload = req.body;
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return res.status(400).json({ error: 'Missing webhook secret' });
    }

    // For this example, we'll assume the webhook is valid
    // In production, you should verify the webhook signature
    const event = JSON.parse(payload.toString());

    switch (event.type) {
      case 'user.created':
        await handleUserCreated(event.data);
        break;
      case 'user.updated':
        await handleUserUpdated(event.data);
        break;
      case 'user.deleted':
        await handleUserDeleted(event.data);
        break;
      default:
        console.log(`Unhandled webhook event: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Get current user profile
router.get('/profile', requireAuth, async (req: any, res) => {
  try {
    const clerkUserId = req.auth.userId;
    
    let user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        businesses: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      // Create user if doesn't exist in our database
      user = await prisma.user.create({
        data: {
          clerkUserId,
          email: req.auth.sessionClaims?.email || '',
          firstName: req.auth.sessionClaims?.firstName || null,
          lastName: req.auth.sessionClaims?.lastName || null,
          profileImageUrl: req.auth.sessionClaims?.imageUrl || null,
        },
        include: {
          businesses: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
          }
        }
      });
    }

    res.json({
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      businesses: user.businesses,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update user profile
router.patch('/profile', requireAuth, async (req: any, res) => {
  try {
    const clerkUserId = req.auth.userId;
    const { firstName, lastName, email } = req.body;

    const user = await prisma.user.update({
      where: { clerkUserId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email && { email }),
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Helper functions for webhook events
async function handleUserCreated(userData: any) {
  try {
    await prisma.user.create({
      data: {
        clerkUserId: userData.id,
        email: userData.email_addresses[0]?.email_address || '',
        firstName: userData.first_name || null,
        lastName: userData.last_name || null,
        profileImageUrl: userData.image_url || null,
      }
    });
    console.log(`User created: ${userData.id}`);
  } catch (error) {
    console.error('Error creating user:', error);
  }
}

async function handleUserUpdated(userData: any) {
  try {
    await prisma.user.update({
      where: { clerkUserId: userData.id },
      data: {
        email: userData.email_addresses[0]?.email_address || '',
        firstName: userData.first_name || null,
        lastName: userData.last_name || null,
        profileImageUrl: userData.image_url || null,
      }
    });
    console.log(`User updated: ${userData.id}`);
  } catch (error) {
    console.error('Error updating user:', error);
  }
}

async function handleUserDeleted(userData: any) {
  try {
    await prisma.user.delete({
      where: { clerkUserId: userData.id }
    });
    console.log(`User deleted: ${userData.id}`);
  } catch (error) {
    console.error('Error deleting user:', error);
  }
}

export default router;
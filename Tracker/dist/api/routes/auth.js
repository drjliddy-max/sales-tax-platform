"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const clerk_1 = require("@/middleware/clerk");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const router = express_1.default.Router();
router.post('/webhook', express_1.default.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const headerPayload = req.headers;
        const svixHeaders = {
            'svix-id': headerPayload['svix-id'],
            'svix-timestamp': headerPayload['svix-timestamp'],
            'svix-signature': headerPayload['svix-signature'],
        };
        const payload = req.body;
        const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
        if (!webhookSecret) {
            return res.status(400).json({ error: 'Missing webhook secret' });
        }
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
    }
    catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});
router.get('/profile', clerk_1.requireAuth, async (req, res) => {
    try {
        const clerkUserId = req.auth.userId;
        const userEmail = req.auth.sessionClaims?.email || '';
        let user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            include: {
                businesses: {
                    where: { isActive: true },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!user) {
            const isAdmin = userEmail === 'john@johnliddy.com' ||
                userEmail === 'admin@sales-tax-tracker.com' ||
                userEmail === 'johnliddy@gmail.com';
            user = await prisma_1.default.user.create({
                data: {
                    clerkUserId,
                    email: userEmail,
                    firstName: req.auth.sessionClaims?.firstName || null,
                    lastName: req.auth.sessionClaims?.lastName || null,
                    profileImageUrl: req.auth.sessionClaims?.imageUrl || null,
                    role: isAdmin ? 'ADMIN' : 'CLIENT',
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
            role: user.role,
            isActive: user.isActive,
            businesses: user.businesses,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        });
    }
    catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});
router.patch('/profile', clerk_1.requireAuth, async (req, res) => {
    try {
        const clerkUserId = req.auth.userId;
        const { firstName, lastName, email } = req.body;
        const user = await prisma_1.default.user.update({
            where: { clerkUserId },
            data: {
                ...(firstName && { firstName }),
                ...(lastName && { lastName }),
                ...(email && { email }),
            }
        });
        res.json(user);
    }
    catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ error: 'Failed to update user profile' });
    }
});
router.get('/role', clerk_1.requireAuth, async (req, res) => {
    try {
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            select: { role: true, isActive: true }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            role: user.role,
            isActive: user.isActive,
            redirectTo: user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'
        });
    }
    catch (error) {
        console.error('Error fetching user role:', error);
        res.status(500).json({ error: 'Failed to fetch user role' });
    }
});
async function handleUserCreated(userData) {
    try {
        const userEmail = userData.email_addresses[0]?.email_address || '';
        const isAdmin = userEmail === 'john@johnliddy.com' ||
            userEmail === 'admin@sales-tax-tracker.com' ||
            userEmail === 'johnliddy@gmail.com';
        await prisma_1.default.user.create({
            data: {
                clerkUserId: userData.id,
                email: userEmail,
                firstName: userData.first_name || null,
                lastName: userData.last_name || null,
                profileImageUrl: userData.image_url || null,
                role: isAdmin ? 'ADMIN' : 'CLIENT',
            }
        });
        console.log(`User created: ${userData.id} with role: ${isAdmin ? 'ADMIN' : 'CLIENT'}`);
    }
    catch (error) {
        console.error('Error creating user:', error);
    }
}
async function handleUserUpdated(userData) {
    try {
        await prisma_1.default.user.update({
            where: { clerkUserId: userData.id },
            data: {
                email: userData.email_addresses[0]?.email_address || '',
                firstName: userData.first_name || null,
                lastName: userData.last_name || null,
                profileImageUrl: userData.image_url || null,
            }
        });
        console.log(`User updated: ${userData.id}`);
    }
    catch (error) {
        console.error('Error updating user:', error);
    }
}
async function handleUserDeleted(userData) {
    try {
        await prisma_1.default.user.delete({
            where: { clerkUserId: userData.id }
        });
        console.log(`User deleted: ${userData.id}`);
    }
    catch (error) {
        console.error('Error deleting user:', error);
    }
}
exports.default = router;
//# sourceMappingURL=auth.js.map
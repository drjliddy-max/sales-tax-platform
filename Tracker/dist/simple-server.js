"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const mongoose_1 = __importDefault(require("mongoose"));
const RevenueService_1 = require("./services/RevenueService");
const RevenueAnalyticsService_1 = require("./services/RevenueAnalyticsService");
const EnhancedAnalyticsService_1 = require("./services/EnhancedAnalyticsService");
const ComprehensiveReportingService_1 = require("./services/ComprehensiveReportingService");
const ReportingService_1 = require("./services/ReportingService");
const ReportTemplate_1 = require("./models/ReportTemplate");
const ScheduledReport_1 = require("./models/ScheduledReport");
const ReportHistory_1 = require("./models/ReportHistory");
const ReportProcessorInitializer_1 = require("./services/startup/ReportProcessorInitializer");
const report_processor_1 = __importDefault(require("./api/routes/report-processor"));
const advanced_export_1 = __importDefault(require("./api/routes/advanced-export"));
const automation_1 = __importDefault(require("./api/routes/automation"));
const insights_simple_1 = __importDefault(require("./api/routes/insights-simple"));
const ReportTemplateInitializer_1 = require("./services/reporting/ReportTemplateInitializer");
const config_1 = require("./config");
const app = (0, express_1.default)();
const PORT = 3001;
let isMongoConnected = false;
async function initializeDatabase() {
    try {
        if (config_1.config?.database?.url) {
            await mongoose_1.default.connect(config_1.config.database.url, {
                dbName: config_1.config.database.name || 'sales-tax-tracker'
            });
            isMongoConnected = true;
            console.log('Connected to MongoDB - using real database for revenue tracking');
            await RevenueService_1.RevenueService.initializeSampleData();
        }
        else {
            console.log('MongoDB not configured - using mock data');
        }
    }
    catch (error) {
        console.log('MongoDB connection failed - falling back to mock data:', error.message);
        isMongoConnected = false;
    }
}
const emailTransporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'demo@salestaxtracker.com',
        pass: process.env.EMAIL_PASSWORD || 'demo_password'
    }
});
const createTestEmailTransporter = async () => {
    try {
        const testAccount = await nodemailer_1.default.createTestAccount();
        return nodemailer_1.default.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
    }
    catch (error) {
        console.log('Using fallback email configuration');
        return null;
    }
};
let testTransporter = null;
createTestEmailTransporter().then(transporter => {
    testTransporter = transporter;
    console.log('Test email service configured');
});
app.use((0, cors_1.default)({
    origin: ['http://localhost:3000', 'http://localhost:3001']
}));
app.use(express_1.default.json());
const csp_1 = require("./middleware/csp");
app.use(csp_1.developmentCSP);
app.post('/api/csp-report', express_1.default.raw({ type: 'application/csp-report' }), csp_1.cspReportHandler);
app.use('/api/report-processor', report_processor_1.default);
app.use('/api/advanced-export', advanced_export_1.default);
app.use('/api/automation', automation_1.default);
app.use('/api/insights', insights_simple_1.default);
const mockClients = [
    {
        id: 'demo_business_1',
        name: 'Demo Restaurant LLC',
        email: 'demo@restaurant.com',
        role: 'business_owner',
        status: 'active',
        plan: 'professional',
        monthlyRevenue: 79.00,
        transactions: 1247,
        joinedAt: '2023-12-15',
        lastLogin: '2024-01-15T09:30:00Z'
    },
    {
        id: 'demo_business_2',
        name: 'Sample Retail Store',
        email: 'owner@retailstore.com',
        role: 'business_owner',
        status: 'trial',
        plan: 'starter',
        monthlyRevenue: 29.00,
        transactions: 456,
        joinedAt: '2024-01-10',
        lastLogin: '2024-01-14T16:45:00Z'
    }
];
const mockTransactions = [
    {
        id: '1',
        businessId: 'demo_business_1',
        date: '2024-01-15',
        amount: 124.99,
        tax: 10.00,
        status: 'Completed',
        customer: 'John Doe',
        items: ['Burger', 'Fries']
    },
    {
        id: '2',
        businessId: 'demo_business_1',
        date: '2024-01-14',
        amount: 89.50,
        tax: 7.16,
        status: 'Completed',
        customer: 'Jane Smith',
        items: ['Pizza', 'Drink']
    },
    {
        id: '3',
        businessId: 'demo_business_2',
        date: '2024-01-15',
        amount: 65.00,
        tax: 5.20,
        status: 'Completed',
        customer: 'Bob Wilson',
        items: ['T-Shirt', 'Hat']
    }
];
const mockRevenueTransactions = [
    {
        id: 'rev_1',
        businessId: 'master_admin',
        date: '2024-01-15',
        amount: 79.00,
        tax: 0,
        status: 'Completed',
        customer: 'Demo Restaurant LLC',
        items: ['Professional Plan - Monthly Subscription'],
        transactionType: 'subscription',
        clientId: 'demo_business_1'
    },
    {
        id: 'rev_2',
        businessId: 'master_admin',
        date: '2024-01-14',
        amount: 29.00,
        tax: 0,
        status: 'Completed',
        customer: 'Sample Retail Store',
        items: ['Starter Plan - Monthly Subscription'],
        transactionType: 'subscription',
        clientId: 'demo_business_2'
    },
    {
        id: 'rev_3',
        businessId: 'master_admin',
        date: '2024-01-13',
        amount: 149.00,
        tax: 0,
        status: 'Completed',
        customer: 'Tech Startup Inc',
        items: ['Enterprise Plan - Monthly Subscription'],
        transactionType: 'subscription',
        clientId: 'demo_business_3'
    },
    {
        id: 'rev_4',
        businessId: 'master_admin',
        date: '2024-01-12',
        amount: 89.00,
        tax: 0,
        status: 'Completed',
        customer: 'Demo Restaurant LLC',
        items: ['Additional Transaction Processing'],
        transactionType: 'overage',
        clientId: 'demo_business_1'
    },
    {
        id: 'rev_5',
        businessId: 'master_admin',
        date: '2024-01-10',
        amount: 199.00,
        tax: 0,
        status: 'Completed',
        customer: 'Local Coffee Shop',
        items: ['Setup & Onboarding Fee'],
        transactionType: 'setup',
        clientId: 'demo_business_4'
    }
];
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'admin@salestaxtracker.com') {
        res.json({
            success: true,
            user: {
                id: 'app_owner_1',
                email: email,
                name: 'App Administrator',
                role: 'app_owner',
                permissions: {
                    canViewAllClients: true,
                    canManageClients: true,
                    canViewTransactions: true,
                    canAddTransactions: true,
                    canEditTransactions: true,
                    canDeleteTransactions: true,
                    canViewReports: true,
                    canGenerateReports: true,
                    canManageIntegrations: true,
                    canManageUsers: true,
                    canViewAuditLog: true,
                    canManageSettings: true,
                }
            },
            token: 'mock_admin_token'
        });
    }
    else {
        res.json({
            success: true,
            user: {
                id: 'client_user_1',
                email: email,
                name: 'John Business Owner',
                role: 'business_owner',
                businessId: 'demo_business_1',
                businessName: 'Demo Restaurant LLC',
                permissions: {
                    canViewAllClients: false,
                    canManageClients: false,
                    canViewTransactions: true,
                    canAddTransactions: true,
                    canEditTransactions: true,
                    canDeleteTransactions: false,
                    canViewReports: true,
                    canGenerateReports: true,
                    canManageIntegrations: true,
                    canManageUsers: true,
                    canViewAuditLog: false,
                    canManageSettings: true,
                }
            },
            token: 'mock_client_token'
        });
    }
});
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    const resetToken = 'reset_' + Date.now() + '_' + Math.random().toString(36);
    const resetLink = `http://localhost:3000/reset-password/${resetToken}`;
    console.log(`Password reset requested for: ${email}`);
    console.log(`Reset link: ${resetLink}`);
    try {
        if (testTransporter) {
            const mailOptions = {
                from: 'noreply@salestaxtracker.com',
                to: email,
                subject: 'Password Reset Request - Sales Tax Tracker',
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #111827;">Password Reset Request</h2>
            <p>You requested a password reset for your Sales Tax Tracker account.</p>
            <p>Click the link below to reset your password:</p>
            <a href="${resetLink}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Reset Password
            </a>
            <p>If you didn't request this reset, you can safely ignore this email.</p>
            <p style="color: #6b7280; font-size: 14px;">This link will expire in 24 hours.</p>
          </div>
        `
            };
            const info = await testTransporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info.messageId);
            console.log('Preview URL:', nodemailer_1.default.getTestMessageUrl(info));
            res.json({
                success: true,
                message: 'Password reset link sent to email',
                resetToken,
                previewUrl: nodemailer_1.default.getTestMessageUrl(info)
            });
        }
        else {
            console.log('Email service not configured, showing reset link in console');
            res.json({
                success: true,
                message: 'Password reset link sent to email (check console for demo link)',
                resetToken,
                demoLink: resetLink
            });
        }
    }
    catch (error) {
        console.error('Failed to send email:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send reset email. Please try again.'
        });
    }
});
app.get('/api/auth/reset-password/:token', (req, res) => {
    const { token } = req.params;
    if (token.startsWith('reset_')) {
        res.json({
            valid: true,
            email: 'user@example.com'
        });
    }
    else {
        res.status(400).json({
            valid: false,
            error: 'Invalid or expired reset token'
        });
    }
});
app.post('/api/auth/reset-password/:token', (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;
    if (token.startsWith('reset_') && newPassword) {
        console.log(`Password reset completed for token: ${token}`);
        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    }
    else {
        res.status(400).json({
            success: false,
            error: 'Invalid token or password'
        });
    }
});
app.get('/api/clients', (req, res) => {
    res.json({ clients: mockClients });
});
app.get('/api/transactions', async (req, res) => {
    const { businessId } = req.query;
    try {
        let filteredTransactions;
        if (businessId === 'master_admin') {
            if (isMongoConnected) {
                filteredTransactions = await RevenueService_1.RevenueService.getAdminRevenueTransactions();
            }
            else {
                filteredTransactions = mockRevenueTransactions;
            }
        }
        else if (businessId) {
            filteredTransactions = mockTransactions.filter(t => t.businessId === businessId);
        }
        else {
            filteredTransactions = mockTransactions;
        }
        res.json({ transactions: filteredTransactions });
    }
    catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});
app.get('/api/dashboard', async (req, res) => {
    const { businessId } = req.query;
    try {
        if (businessId === 'master_admin') {
            let dashboardData;
            if (isMongoConnected) {
                const metrics = await RevenueService_1.RevenueService.getRevenueMetrics();
                dashboardData = {
                    totalClients: metrics.totalClients,
                    platformRevenue: Math.round(metrics.mrr),
                    totalTransactions: metrics.activeSubscriptions * 50,
                    totalTaxTracked: 95234,
                    recentActivity: [
                        { type: 'new_client', message: 'New client registration: Tech Startup Inc', timestamp: '2024-01-15' },
                        { type: 'upgrade', message: 'Restaurant LLC upgraded to Professional plan', timestamp: '2024-01-14' }
                    ]
                };
            }
            else {
                dashboardData = {
                    totalClients: 24,
                    platformRevenue: 4890,
                    totalTransactions: 15847,
                    totalTaxTracked: 95234,
                    recentActivity: [
                        { type: 'new_client', message: 'New client registration: Tech Startup Inc', timestamp: '2024-01-15' },
                        { type: 'upgrade', message: 'Restaurant LLC upgraded to Professional plan', timestamp: '2024-01-14' }
                    ]
                };
            }
            res.json(dashboardData);
        }
        else {
            const clientTransactions = mockTransactions.filter(t => t.businessId === businessId);
            const totalSales = clientTransactions.reduce((sum, t) => sum + t.amount, 0);
            const totalTax = clientTransactions.reduce((sum, t) => sum + t.tax, 0);
            res.json({
                totalSales,
                totalTax,
                transactionCount: clientTransactions.length,
                recentTransactions: clientTransactions.slice(0, 5)
            });
        }
    }
    catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});
app.post('/api/invitations', (req, res) => {
    const invitation = {
        id: `inv_${Date.now()}`,
        ...req.body,
        status: 'pending',
        invitedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
    res.json({ invitation });
});
app.get('/api/invitations', (req, res) => {
    res.json({ invitations: [] });
});
app.post('/api/invitations/:id/resend', (req, res) => {
    res.json({ success: true });
});
app.post('/api/invitations/:id/revoke', (req, res) => {
    res.json({ success: true });
});
app.get('/api/invitations/validate/:token', (req, res) => {
    res.json({
        invitation: {
            id: req.params.token,
            email: 'test@example.com',
            role: 'business_owner',
            status: 'pending',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
    });
});
app.post('/api/invitations/:id/complete', (req, res) => {
    res.json({
        userId: 'user_' + Date.now(),
        businessId: 'business_' + Date.now()
    });
});
app.post('/api/onboarding', (req, res) => {
    res.json({
        onboarding: {
            id: 'onboarding_' + Date.now(),
            ...req.body
        }
    });
});
app.get('/api/onboarding/:userId', (req, res) => {
    res.json({ onboarding: null });
});
app.patch('/api/onboarding/:id/steps/:stepId', (req, res) => {
    res.json({ success: true });
});
app.post('/api/email/send', (req, res) => {
    console.log('Email would be sent:', req.body);
    res.json({ success: true });
});
app.post('/api/transactions', (req, res) => {
    const newTransaction = {
        id: Date.now().toString(),
        businessId: req.body.businessId || 'demo_business_1',
        date: req.body.date || new Date().toISOString().split('T')[0],
        amount: parseFloat(req.body.amount) || 0,
        tax: parseFloat(req.body.tax) || 0,
        customer: req.body.customer || 'Unknown Customer',
        items: req.body.items || [],
        status: 'Completed'
    };
    mockTransactions.push(newTransaction);
    res.json({ transaction: newTransaction, success: true });
});
app.put('/api/transactions/:id', (req, res) => {
    const transactionId = req.params.id;
    const transactionIndex = mockTransactions.findIndex(t => t.id === transactionId);
    if (transactionIndex === -1) {
        return res.status(404).json({ error: 'Transaction not found' });
    }
    const allowedFields = ['businessId', 'date', 'amount', 'tax', 'customer', 'items', 'status'];
    const sanitizedUpdate = {};
    for (const field of allowedFields) {
        if (req.body.hasOwnProperty(field) && req.body[field] !== undefined) {
            switch (field) {
                case 'amount':
                case 'tax':
                    const numValue = parseFloat(req.body[field]);
                    if (!isNaN(numValue) && isFinite(numValue)) {
                        sanitizedUpdate[field] = numValue;
                    }
                    break;
                case 'date':
                    if (typeof req.body[field] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body[field])) {
                        sanitizedUpdate[field] = req.body[field];
                    }
                    break;
                case 'customer':
                    if (typeof req.body[field] === 'string' && req.body[field].length <= 255) {
                        sanitizedUpdate[field] = req.body[field].trim();
                    }
                    break;
                case 'items':
                    if (Array.isArray(req.body[field])) {
                        sanitizedUpdate[field] = req.body[field];
                    }
                    break;
                case 'businessId':
                case 'status':
                    if (typeof req.body[field] === 'string') {
                        sanitizedUpdate[field] = req.body[field].trim();
                    }
                    break;
            }
        }
    }
    mockTransactions[transactionIndex] = {
        ...mockTransactions[transactionIndex],
        ...sanitizedUpdate
    };
    res.json({ transaction: mockTransactions[transactionIndex], success: true });
});
app.delete('/api/transactions/:id', (req, res) => {
    const transactionId = req.params.id;
    const transactionIndex = mockTransactions.findIndex(t => t.id === transactionId);
    if (transactionIndex === -1) {
        return res.status(404).json({ error: 'Transaction not found' });
    }
    mockTransactions.splice(transactionIndex, 1);
    res.json({ success: true });
});
app.get('/api/reports/sales-tax', (req, res) => {
    const { businessId, startDate, endDate } = req.query;
    let filteredTransactions = mockTransactions;
    if (businessId && businessId !== 'master_admin') {
        filteredTransactions = mockTransactions.filter(t => t.businessId === businessId);
    }
    const totalSales = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalTax = filteredTransactions.reduce((sum, t) => sum + t.tax, 0);
    res.json({
        period: { startDate: startDate || '2024-01-01', endDate: endDate || '2024-01-31' },
        summary: {
            totalSales,
            totalTax,
            transactionCount: filteredTransactions.length,
            averageTransactionValue: totalSales / filteredTransactions.length || 0
        },
        byJurisdiction: [
            { jurisdiction: 'Texas State', rate: 0.0625, taxCollected: totalTax * 0.6 },
            { jurisdiction: 'Travis County', rate: 0.01, taxCollected: totalTax * 0.2 },
            { jurisdiction: 'Austin City', rate: 0.02, taxCollected: totalTax * 0.2 }
        ],
        transactions: filteredTransactions
    });
});
app.get('/api/integrations', (req, res) => {
    const { businessId } = req.query;
    res.json({
        integrations: [
            {
                id: 'square_1',
                type: 'square',
                name: 'Square POS',
                status: 'connected',
                lastSync: '2024-01-15T10:30:00Z',
                transactionsSynced: 247,
                isActive: true
            },
            {
                id: 'quickbooks_1',
                type: 'quickbooks',
                name: 'QuickBooks Online',
                status: 'disconnected',
                lastSync: null,
                transactionsSynced: 0,
                isActive: false
            }
        ]
    });
});
app.post('/api/integrations', (req, res) => {
    const integration = {
        id: `${req.body.type}_${Date.now()}`,
        ...req.body,
        status: 'pending',
        lastSync: null,
        transactionsSynced: 0,
        isActive: false
    };
    res.json({ integration, success: true });
});
app.post('/api/integrations/:id/test', (req, res) => {
    res.json({
        success: true,
        message: 'Connection test successful',
        data: {
            apiVersion: '2.0',
            permissions: ['read_transactions', 'read_customers'],
            rateLimit: '1000 requests/hour'
        }
    });
});
app.post('/api/integrations/:id/sync', (req, res) => {
    res.json({
        success: true,
        syncJobId: 'sync_' + Date.now(),
        message: 'Sync started successfully'
    });
});
app.get('/api/analytics/mrr', async (req, res) => {
    try {
        const { startDate, endDate, tierId } = req.query;
        const result = await RevenueAnalyticsService_1.RevenueAnalyticsService.calculateMRR(startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined, tierId ? new mongoose_1.default.Types.ObjectId(tierId) : undefined);
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching MRR:', error);
        res.status(500).json({ error: 'Failed to calculate MRR' });
    }
});
app.get('/api/analytics/arr', async (req, res) => {
    try {
        const { startDate, endDate, tierId } = req.query;
        const result = await RevenueAnalyticsService_1.RevenueAnalyticsService.calculateARR(startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined, tierId ? new mongoose_1.default.Types.ObjectId(tierId) : undefined);
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching ARR:', error);
        res.status(500).json({ error: 'Failed to calculate ARR' });
    }
});
app.get('/api/analytics/revenue-by-stream', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        const result = await RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueByStream(new Date(startDate), new Date(endDate));
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching revenue by stream:', error);
        res.status(500).json({ error: 'Failed to get revenue by stream' });
    }
});
app.get('/api/analytics/revenue-by-tier', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        const result = await RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueByTier(new Date(startDate), new Date(endDate));
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching revenue by tier:', error);
        res.status(500).json({ error: 'Failed to get revenue by tier' });
    }
});
app.get('/api/analytics/revenue-summary', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        const result = await RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueSummary(new Date(startDate), new Date(endDate));
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching revenue summary:', error);
        res.status(500).json({ error: 'Failed to get revenue summary' });
    }
});
app.get('/api/analytics/growth-rate', async (req, res) => {
    try {
        const { currentStart, currentEnd, previousStart, previousEnd } = req.query;
        if (!currentStart || !currentEnd || !previousStart || !previousEnd) {
            return res.status(400).json({
                error: 'currentStart, currentEnd, previousStart, and previousEnd are required'
            });
        }
        const result = await RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueGrowthRate(new Date(currentStart), new Date(currentEnd), new Date(previousStart), new Date(previousEnd));
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching growth rate:', error);
        res.status(500).json({ error: 'Failed to calculate growth rate' });
    }
});
app.get('/api/analytics/customer-lifetime-value', async (req, res) => {
    try {
        const result = await RevenueAnalyticsService_1.RevenueAnalyticsService.getCustomerLifetimeValueByTier();
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching customer lifetime value:', error);
        res.status(500).json({ error: 'Failed to get customer lifetime value' });
    }
});
app.get('/api/analytics/churn-analysis', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        const result = await RevenueAnalyticsService_1.RevenueAnalyticsService.getChurnAnalysis(new Date(startDate), new Date(endDate));
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching churn analysis:', error);
        res.status(500).json({ error: 'Failed to get churn analysis' });
    }
});
app.get('/api/enhanced-analytics/cohort-analysis', async (req, res) => {
    try {
        const { months } = req.query;
        const result = await EnhancedAnalyticsService_1.EnhancedAnalyticsService.getCohortAnalysis(months ? parseInt(months) : 12);
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching cohort analysis:', error);
        res.status(500).json({ error: 'Failed to get cohort analysis' });
    }
});
app.get('/api/enhanced-analytics/churn-metrics', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        const result = await EnhancedAnalyticsService_1.EnhancedAnalyticsService.calculateChurnMetrics(new Date(startDate), new Date(endDate));
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching churn metrics:', error);
        res.status(500).json({ error: 'Failed to get churn metrics' });
    }
});
app.get('/api/enhanced-analytics/client-health/:clientId', async (req, res) => {
    try {
        const { clientId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(clientId)) {
            return res.status(400).json({ error: 'Invalid client ID' });
        }
        const result = await EnhancedAnalyticsService_1.EnhancedAnalyticsService.calculateClientHealthScore(new mongoose_1.default.Types.ObjectId(clientId));
        res.json(result);
    }
    catch (error) {
        console.error('Error calculating client health score:', error);
        res.status(500).json({ error: 'Failed to calculate client health score' });
    }
});
app.get('/api/enhanced-analytics/revenue-forecast', async (req, res) => {
    try {
        const { months } = req.query;
        const result = await EnhancedAnalyticsService_1.EnhancedAnalyticsService.generateRevenueForecast(months ? parseInt(months) : 6);
        res.json(result);
    }
    catch (error) {
        console.error('Error generating revenue forecast:', error);
        res.status(500).json({ error: 'Failed to generate revenue forecast' });
    }
});
app.get('/api/enhanced-analytics/top-clients-health', async (req, res) => {
    try {
        const { limit } = req.query;
        const result = await EnhancedAnalyticsService_1.EnhancedAnalyticsService.getTopClientsHealthScores(limit ? parseInt(limit) : 10);
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching top clients health scores:', error);
        res.status(500).json({ error: 'Failed to get top clients health scores' });
    }
});
app.get('/api/enhanced-analytics/dashboard', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        const result = await EnhancedAnalyticsService_1.EnhancedAnalyticsService.getAdvancedDashboardData(new Date(startDate), new Date(endDate));
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching advanced dashboard data:', error);
        res.status(500).json({ error: 'Failed to get advanced dashboard data' });
    }
});
const reportingService = new ComprehensiveReportingService_1.ComprehensiveReportingService();
app.get('/api/reports/executive', async (req, res) => {
    try {
        const { startDate, endDate, format = 'json' } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        const result = await reportingService.generateExecutiveReport(new Date(startDate), new Date(endDate), { format: format });
        if (format === 'pdf' || format === 'excel') {
            const fileResult = result;
            res.download(fileResult.filePath, fileResult.fileName);
        }
        else {
            res.json(result);
        }
    }
    catch (error) {
        console.error('Error generating executive report:', error);
        res.status(500).json({ error: 'Failed to generate executive report' });
    }
});
app.get('/api/reports/board/:quarter/:year', async (req, res) => {
    try {
        const { quarter, year } = req.params;
        const { format = 'json' } = req.query;
        const quarterNum = parseInt(quarter);
        const yearNum = parseInt(year);
        if (quarterNum < 1 || quarterNum > 4) {
            return res.status(400).json({ error: 'Quarter must be between 1 and 4' });
        }
        const result = await reportingService.generateBoardReport(quarterNum, yearNum);
        if (format === 'pdf') {
            const pdfResult = await reportingService.generatePDFReport(result, 'board');
            res.download(pdfResult.filePath, pdfResult.fileName);
        }
        else if (format === 'excel') {
            const excelResult = await reportingService.generateExcelReport(result, 'board');
            res.download(excelResult.filePath, excelResult.fileName);
        }
        else {
            res.json(result);
        }
    }
    catch (error) {
        console.error('Error generating board report:', error);
        res.status(500).json({ error: 'Failed to generate board report' });
    }
});
app.post('/api/reports/schedule', async (req, res) => {
    try {
        const { templateId, schedule } = req.body;
        if (!templateId || !schedule) {
            return res.status(400).json({ error: 'templateId and schedule are required' });
        }
        const result = await reportingService.scheduleReport(templateId, schedule);
        res.json(result);
    }
    catch (error) {
        console.error('Error scheduling report:', error);
        res.status(500).json({ error: 'Failed to schedule report' });
    }
});
app.post('/api/reports/process-scheduled', async (req, res) => {
    try {
        await reportingService.processScheduledReports();
        res.json({ success: true, message: 'Scheduled reports processed successfully' });
    }
    catch (error) {
        console.error('Error processing scheduled reports:', error);
        res.status(500).json({ error: 'Failed to process scheduled reports' });
    }
});
app.get('/api/reports/export/:format', async (req, res) => {
    try {
        const { format } = req.params;
        const { startDate, endDate, reportType = 'executive' } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        if (!['pdf', 'excel'].includes(format)) {
            return res.status(400).json({ error: 'Format must be pdf or excel' });
        }
        const reportData = await reportingService.generateExecutiveReport(new Date(startDate), new Date(endDate));
        let fileResult;
        if (format === 'pdf') {
            fileResult = await reportingService.generatePDFReport(reportData, reportType);
        }
        else {
            fileResult = await reportingService.generateExcelReport(reportData, reportType);
        }
        res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileResult.fileName}"`);
        res.download(fileResult.filePath, fileResult.fileName);
    }
    catch (error) {
        console.error('Error exporting report:', error);
        res.status(500).json({ error: 'Failed to export report' });
    }
});
app.post('/api/reports/operational/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { startDate, endDate, format = 'json' } = req.body;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        const validTypes = ['revenue_operations', 'customer_success', 'sales_performance', 'financial_analysis', 'churn_analysis', 'cohort_performance'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Invalid report type' });
        }
        let reportData;
        switch (type) {
            case 'revenue_operations':
                reportData = await EnhancedAnalyticsService_1.EnhancedAnalyticsService.getAdvancedDashboardData(new Date(startDate), new Date(endDate));
                break;
            case 'customer_success':
                reportData = {
                    health_scores: await EnhancedAnalyticsService_1.EnhancedAnalyticsService.getTopClientsHealthScores(50),
                    churn_metrics: await EnhancedAnalyticsService_1.EnhancedAnalyticsService.calculateChurnMetrics(new Date(startDate), new Date(endDate))
                };
                break;
            default:
                reportData = await EnhancedAnalyticsService_1.EnhancedAnalyticsService.getAdvancedDashboardData(new Date(startDate), new Date(endDate));
        }
        if (format === 'excel') {
            const excelFile = await reportingService.generateExcelReport(reportData, 'operational');
            res.json({
                message: 'Operational report generated successfully',
                file_path: excelFile.filePath,
                file_name: excelFile.fileName,
                download_url: `/api/reports/download/${excelFile.fileName}`
            });
        }
        else {
            res.json(reportData);
        }
    }
    catch (error) {
        console.error('Error generating operational report:', error);
        res.status(500).json({ error: 'Failed to generate operational report' });
    }
});
app.post('/api/reports/custom', async (req, res) => {
    try {
        const { config } = req.body;
        if (!config || !config.sections) {
            return res.status(400).json({ error: 'Report configuration with sections is required' });
        }
        const reportData = {
            config,
            generated_at: new Date().toISOString(),
            sections: {}
        };
        for (const section of config.sections) {
            switch (section.type) {
                case 'metrics_summary':
                    if (section.metrics?.includes('mrr')) {
                        reportData.sections[section.id] = await RevenueAnalyticsService_1.RevenueAnalyticsService.calculateMRR();
                    }
                    break;
                case 'revenue_chart':
                    const startDate = section.filters?.startDate ? new Date(section.filters.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                    const endDate = section.filters?.endDate ? new Date(section.filters.endDate) : new Date();
                    reportData.sections[section.id] = await RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueByStream(startDate, endDate);
                    break;
                case 'cohort_table':
                    reportData.sections[section.id] = await EnhancedAnalyticsService_1.EnhancedAnalyticsService.getCohortAnalysis(section.months || 12);
                    break;
                case 'client_list':
                    reportData.sections[section.id] = await EnhancedAnalyticsService_1.EnhancedAnalyticsService.getTopClientsHealthScores(section.limit || 20);
                    break;
                case 'forecast_chart':
                    reportData.sections[section.id] = await EnhancedAnalyticsService_1.EnhancedAnalyticsService.generateRevenueForecast(section.months || 6);
                    break;
                default:
                    reportData.sections[section.id] = { error: `Unknown section type: ${section.type}` };
            }
        }
        res.json(reportData);
    }
    catch (error) {
        console.error('Error creating custom report:', error);
        res.status(500).json({ error: 'Failed to create custom report' });
    }
});
app.get('/api/reports/templates', async (req, res) => {
    try {
        const { category } = req.query;
        const filters = {};
        if (category) {
            filters.category = category;
        }
        const templates = await ReportingService_1.ReportingService.getTemplates(filters);
        res.json(templates);
    }
    catch (error) {
        console.error('Error fetching report templates:', error);
        res.status(500).json({ error: 'Failed to fetch report templates' });
    }
});
app.post('/api/reports/templates', async (req, res) => {
    try {
        const templateData = req.body;
        if (!templateData.name || !templateData.category || !templateData.templateConfig) {
            return res.status(400).json({ error: 'name, category, and templateConfig are required' });
        }
        const template = await ReportingService_1.ReportingService.createTemplate(templateData);
        res.json(template);
    }
    catch (error) {
        console.error('Error creating report template:', error);
        res.status(500).json({ error: 'Failed to create report template' });
    }
});
app.get('/api/reports/scheduled', async (req, res) => {
    try {
        const scheduledReports = await ScheduledReport_1.ScheduledReport.find({ isActive: true })
            .populate('templateId', 'name category')
            .sort({ nextRunDate: 1 });
        res.json(scheduledReports);
    }
    catch (error) {
        console.error('Error fetching scheduled reports:', error);
        res.status(500).json({ error: 'Failed to fetch scheduled reports' });
    }
});
app.get('/api/reports/download/:fileName', (req, res) => {
    try {
        const { fileName } = req.params;
        const filePath = `reports/${fileName}`;
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                res.status(404).json({ error: 'File not found' });
            }
        });
    }
    catch (error) {
        console.error('Error downloading report:', error);
        res.status(404).json({ error: 'File not found' });
    }
});
app.get('/api/reports/history', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const history = await ReportHistory_1.ReportHistory.find()
            .populate('templateId', 'name category')
            .populate('scheduledReportId', 'name frequency')
            .sort({ generatedAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset));
        res.json(history);
    }
    catch (error) {
        console.error('Error fetching report history:', error);
        res.status(500).json({ error: 'Failed to fetch report history' });
    }
});
app.post('/api/reports/initialize-templates', async (req, res) => {
    try {
        await ReportTemplateInitializer_1.ReportTemplateInitializer.initializeDefaultTemplates();
        const summary = await ReportTemplateInitializer_1.ReportTemplateInitializer.getTemplatesSummary();
        res.json({
            message: 'Default templates initialized successfully',
            summary,
            totalCount: ReportTemplateInitializer_1.ReportTemplateInitializer.getTotalTemplateCount()
        });
    }
    catch (error) {
        console.error('Error initializing default templates:', error);
        res.status(500).json({ error: 'Failed to initialize default templates' });
    }
});
app.get('/api/reports/templates/summary', async (req, res) => {
    try {
        const summary = await ReportTemplateInitializer_1.ReportTemplateInitializer.getTemplatesSummary();
        const categories = ReportTemplateInitializer_1.ReportTemplateInitializer.getAvailableCategories();
        const totalCount = await ReportTemplate_1.ReportTemplate.countDocuments();
        const defaultCount = await ReportTemplate_1.ReportTemplate.countDocuments({ isDefault: true });
        res.json({
            summary,
            categories,
            totalCount,
            defaultCount,
            customCount: totalCount - defaultCount
        });
    }
    catch (error) {
        console.error('Error getting template summary:', error);
        res.status(500).json({ error: 'Failed to get template summary' });
    }
});
app.post('/api/reports/templates/reset-defaults', async (req, res) => {
    try {
        await ReportTemplateInitializer_1.ReportTemplateInitializer.resetDefaultTemplates();
        const summary = await ReportTemplateInitializer_1.ReportTemplateInitializer.getTemplatesSummary();
        res.json({
            message: 'Default templates reset successfully',
            summary
        });
    }
    catch (error) {
        console.error('Error resetting default templates:', error);
        res.status(500).json({ error: 'Failed to reset default templates' });
    }
});
app.listen(PORT, async () => {
    console.log(`Simple API server running on port ${PORT}`);
    console.log('Environment: development (Redis-free mode)');
    await initializeDatabase();
    if (isMongoConnected) {
        try {
            await ReportTemplateInitializer_1.ReportTemplateInitializer.initializeDefaultTemplates();
            await ReportProcessorInitializer_1.reportProcessorInitializer.initialize();
            console.log('✅ Report system fully initialized');
        }
        catch (error) {
            console.error('Failed to initialize report system:', error);
        }
    }
    else {
        console.log('Report system disabled - MongoDB not available');
    }
});
//# sourceMappingURL=simple-server.js.map
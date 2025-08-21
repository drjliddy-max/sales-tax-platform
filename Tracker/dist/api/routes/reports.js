"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const prisma_1 = __importDefault(require("@/lib/prisma"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const exceljs_1 = __importDefault(require("exceljs"));
const library_1 = require("@prisma/client/runtime/library");
const router = express_1.default.Router();
const createReportSchema = joi_1.default.object({
    businessId: joi_1.default.string().required(),
    name: joi_1.default.string().min(1).max(255).required(),
    type: joi_1.default.string().valid('TAX_RETURN', 'SALES_SUMMARY', 'JURISDICTION_BREAKDOWN', 'MONTHLY_SUMMARY', 'QUARTERLY_SUMMARY', 'YEARLY_SUMMARY').required(),
    period: joi_1.default.string().valid('MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM').required(),
    startDate: joi_1.default.date().required(),
    endDate: joi_1.default.date().required(),
    fileFormat: joi_1.default.string().valid('PDF', 'CSV', 'XLSX').default('PDF')
});
const queryReportsSchema = joi_1.default.object({
    businessId: joi_1.default.string().optional(),
    type: joi_1.default.string().optional(),
    status: joi_1.default.string().valid('PENDING', 'GENERATING', 'COMPLETED', 'FAILED').optional(),
    limit: joi_1.default.number().integer().min(1).max(50).default(20),
    offset: joi_1.default.number().integer().min(0).default(0)
});
router.get('/', async (req, res) => {
    try {
        const { error, value } = queryReportsSchema.validate(req.query);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            select: {
                businesses: {
                    where: { isActive: true },
                    select: { id: true }
                }
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const businessIds = user.businesses.map(b => b.id);
        const where = {
            businessId: { in: businessIds }
        };
        if (value.businessId) {
            if (!businessIds.includes(value.businessId)) {
                return res.status(403).json({ error: 'Access denied to this business' });
            }
            where.businessId = value.businessId;
        }
        if (value.type) {
            where.type = value.type;
        }
        if (value.status) {
            where.status = value.status;
        }
        const [reports, total] = await Promise.all([
            prisma_1.default.report.findMany({
                where,
                include: {
                    business: {
                        select: { name: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: value.limit,
                skip: value.offset
            }),
            prisma_1.default.report.count({ where })
        ]);
        res.json({
            data: reports,
            pagination: {
                total,
                limit: value.limit,
                offset: value.offset,
                hasMore: value.offset + value.limit < total
            }
        });
    }
    catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            select: {
                businesses: {
                    where: { isActive: true },
                    select: { id: true }
                }
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const businessIds = user.businesses.map(b => b.id);
        const report = await prisma_1.default.report.findUnique({
            where: { id: req.params.id },
            include: {
                business: {
                    select: { name: true, state: true }
                }
            }
        });
        if (!report || !businessIds.includes(report.businessId)) {
            return res.status(404).json({ error: 'Report not found' });
        }
        res.json(report);
    }
    catch (error) {
        console.error('Error fetching report:', error);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { error, value } = createReportSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
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
        const report = await prisma_1.default.report.create({
            data: {
                businessId: value.businessId,
                name: value.name,
                type: value.type,
                period: value.period,
                startDate: value.startDate,
                endDate: value.endDate,
                fileFormat: value.fileFormat,
                status: 'PENDING'
            },
            include: {
                business: {
                    select: { name: true, state: true }
                }
            }
        });
        generateReportAsync(report.id);
        res.status(201).json(report);
    }
    catch (error) {
        console.error('Error creating report:', error);
        res.status(500).json({ error: 'Failed to create report' });
    }
});
router.get('/:businessId/sales-summary', async (req, res) => {
    try {
        const { businessId } = req.params;
        const { startDate, endDate, format = 'json' } = req.query;
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
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
        const where = {
            businessId,
            status: 'COMPLETED'
        };
        if (startDate || endDate) {
            where.transactionDate = {};
            if (startDate)
                where.transactionDate.gte = new Date(startDate);
            if (endDate)
                where.transactionDate.lte = new Date(endDate);
        }
        const [summary, transactions] = await Promise.all([
            prisma_1.default.transaction.aggregate({
                where,
                _sum: {
                    amount: true,
                    taxAmount: true,
                    totalAmount: true,
                    federalTax: true,
                    stateTax: true,
                    countyTax: true,
                    cityTax: true,
                    specialDistrictTax: true
                },
                _count: true
            }),
            prisma_1.default.transaction.findMany({
                where,
                select: {
                    id: true,
                    amount: true,
                    taxAmount: true,
                    totalAmount: true,
                    federalTax: true,
                    stateTax: true,
                    countyTax: true,
                    cityTax: true,
                    specialDistrictTax: true,
                    productCategory: true,
                    customerType: true,
                    transactionDate: true,
                    saleLocation: true
                },
                orderBy: { transactionDate: 'desc' }
            })
        ]);
        const reportData = {
            business: user.businesses[0],
            period: { startDate, endDate },
            summary: {
                totalTransactions: summary._count,
                totalRevenue: parseFloat(summary._sum.amount?.toString() || '0'),
                totalTax: parseFloat(summary._sum.taxAmount?.toString() || '0'),
                totalAmount: parseFloat(summary._sum.totalAmount?.toString() || '0'),
                taxBreakdown: {
                    federal: parseFloat(summary._sum.federalTax?.toString() || '0'),
                    state: parseFloat(summary._sum.stateTax?.toString() || '0'),
                    county: parseFloat(summary._sum.countyTax?.toString() || '0'),
                    city: parseFloat(summary._sum.cityTax?.toString() || '0'),
                    specialDistrict: parseFloat(summary._sum.specialDistrictTax?.toString() || '0')
                }
            },
            transactions
        };
        if (format === 'pdf') {
            const pdfBuffer = await generatePDFReport(reportData);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="sales-summary.pdf"');
            res.send(pdfBuffer);
        }
        else if (format === 'xlsx') {
            const excelBuffer = await generateExcelReport(reportData);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="sales-summary.xlsx"');
            res.send(excelBuffer);
        }
        else {
            res.json(reportData);
        }
    }
    catch (error) {
        console.error('Error generating sales summary:', error);
        res.status(500).json({ error: 'Failed to generate sales summary' });
    }
});
async function generateReportAsync(reportId) {
    try {
        await prisma_1.default.report.update({
            where: { id: reportId },
            data: { status: 'GENERATING' }
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        const report = await prisma_1.default.report.findUnique({
            where: { id: reportId },
            include: { business: true }
        });
        if (!report)
            return;
        const transactions = await prisma_1.default.transaction.findMany({
            where: {
                businessId: report.businessId,
                transactionDate: {
                    gte: report.startDate,
                    lte: report.endDate
                },
                status: 'COMPLETED'
            }
        });
        const totalTransactions = transactions.length;
        const totalAmount = transactions.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
        const totalTax = transactions.reduce((sum, t) => sum + parseFloat(t.taxAmount.toString()), 0);
        await prisma_1.default.report.update({
            where: { id: reportId },
            data: {
                status: 'COMPLETED',
                totalTransactions,
                totalAmount: new library_1.Decimal(totalAmount),
                totalTax: new library_1.Decimal(totalTax),
                generatedAt: new Date(),
                fileUrl: `/api/reports/${reportId}/download`
            }
        });
    }
    catch (error) {
        console.error('Error generating report:', error);
        await prisma_1.default.report.update({
            where: { id: reportId },
            data: { status: 'FAILED' }
        });
    }
}
async function generatePDFReport(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit_1.default();
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.fontSize(20).text('Sales Tax Summary Report', 50, 50);
            doc.fontSize(12).text(`Business: ${data.business.name}`, 50, 100);
            doc.text(`Period: ${data.period.startDate} to ${data.period.endDate}`, 50, 120);
            doc.text(`Total Transactions: ${data.summary.totalTransactions}`, 50, 160);
            doc.text(`Total Revenue: $${data.summary.totalRevenue.toFixed(2)}`, 50, 180);
            doc.text(`Total Tax: $${data.summary.totalTax.toFixed(2)}`, 50, 200);
            doc.text(`Total Amount: $${data.summary.totalAmount.toFixed(2)}`, 50, 220);
            doc.text('Tax Breakdown:', 50, 260);
            doc.text(`Federal: $${data.summary.taxBreakdown.federal.toFixed(4)}`, 70, 280);
            doc.text(`State: $${data.summary.taxBreakdown.state.toFixed(4)}`, 70, 300);
            doc.text(`County: $${data.summary.taxBreakdown.county.toFixed(4)}`, 70, 320);
            doc.text(`City: $${data.summary.taxBreakdown.city.toFixed(4)}`, 70, 340);
            doc.text(`Special District: $${data.summary.taxBreakdown.specialDistrict.toFixed(4)}`, 70, 360);
            doc.end();
        }
        catch (error) {
            reject(error);
        }
    });
}
async function generateExcelReport(data) {
    const workbook = new exceljs_1.default.Workbook();
    const worksheet = workbook.addWorksheet('Sales Tax Summary');
    worksheet.addRow(['Sales Tax Summary Report']);
    worksheet.addRow([`Business: ${data.business.name}`]);
    worksheet.addRow([`Period: ${data.period.startDate} to ${data.period.endDate}`]);
    worksheet.addRow([]);
    worksheet.addRow(['Summary']);
    worksheet.addRow(['Total Transactions', data.summary.totalTransactions]);
    worksheet.addRow(['Total Revenue', data.summary.totalRevenue]);
    worksheet.addRow(['Total Tax', data.summary.totalTax]);
    worksheet.addRow(['Total Amount', data.summary.totalAmount]);
    worksheet.addRow([]);
    worksheet.addRow(['Tax Breakdown']);
    worksheet.addRow(['Federal Tax', data.summary.taxBreakdown.federal]);
    worksheet.addRow(['State Tax', data.summary.taxBreakdown.state]);
    worksheet.addRow(['County Tax', data.summary.taxBreakdown.county]);
    worksheet.addRow(['City Tax', data.summary.taxBreakdown.city]);
    worksheet.addRow(['Special District Tax', data.summary.taxBreakdown.specialDistrict]);
    worksheet.addRow([]);
    worksheet.addRow(['Transaction Details']);
    worksheet.addRow(['Date', 'Amount', 'Tax Amount', 'Total', 'Location', 'Category', 'Customer Type']);
    data.transactions.forEach((transaction) => {
        worksheet.addRow([
            transaction.transactionDate.toISOString().split('T')[0],
            parseFloat(transaction.amount.toString()),
            parseFloat(transaction.taxAmount.toString()),
            parseFloat(transaction.totalAmount.toString()),
            transaction.saleLocation,
            transaction.productCategory || 'N/A',
            transaction.customerType
        ]);
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
}
router.get('/:businessId/tax-liability', async (req, res) => {
    try {
        const { businessId } = req.params;
        const { startDate, endDate, jurisdiction } = req.query;
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
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
        const where = {
            businessId,
            status: 'COMPLETED'
        };
        if (startDate || endDate) {
            where.transactionDate = {};
            if (startDate)
                where.transactionDate.gte = new Date(startDate);
            if (endDate)
                where.transactionDate.lte = new Date(endDate);
        }
        const taxLiability = await prisma_1.default.transaction.aggregate({
            where,
            _sum: {
                federalTax: true,
                stateTax: true,
                countyTax: true,
                cityTax: true,
                specialDistrictTax: true,
                taxAmount: true
            }
        });
        const locationBreakdown = await prisma_1.default.transaction.groupBy({
            by: ['saleLocation'],
            where,
            _sum: {
                taxAmount: true,
                amount: true
            },
            _count: true,
            orderBy: {
                _sum: {
                    taxAmount: 'desc'
                }
            }
        });
        res.json({
            business: user.businesses[0],
            period: { startDate, endDate },
            totalTaxLiability: parseFloat(taxLiability._sum.taxAmount?.toString() || '0'),
            jurisdictionBreakdown: {
                federal: parseFloat(taxLiability._sum.federalTax?.toString() || '0'),
                state: parseFloat(taxLiability._sum.stateTax?.toString() || '0'),
                county: parseFloat(taxLiability._sum.countyTax?.toString() || '0'),
                city: parseFloat(taxLiability._sum.cityTax?.toString() || '0'),
                specialDistrict: parseFloat(taxLiability._sum.specialDistrictTax?.toString() || '0')
            },
            locationBreakdown: locationBreakdown.map(item => ({
                location: item.saleLocation,
                transactions: item._count,
                revenue: parseFloat(item._sum.amount?.toString() || '0'),
                tax: parseFloat(item._sum.taxAmount?.toString() || '0')
            }))
        });
    }
    catch (error) {
        console.error('Error generating tax liability report:', error);
        res.status(500).json({ error: 'Failed to generate tax liability report' });
    }
});
router.get('/:id/download', async (req, res) => {
    try {
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            select: {
                businesses: {
                    where: { isActive: true },
                    select: { id: true }
                }
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const businessIds = user.businesses.map(b => b.id);
        const report = await prisma_1.default.report.findUnique({
            where: { id: req.params.id },
            include: {
                business: true
            }
        });
        if (!report || !businessIds.includes(report.businessId)) {
            return res.status(404).json({ error: 'Report not found' });
        }
        if (report.status !== 'COMPLETED') {
            return res.status(400).json({ error: 'Report not ready for download' });
        }
        const transactions = await prisma_1.default.transaction.findMany({
            where: {
                businessId: report.businessId,
                transactionDate: {
                    gte: report.startDate,
                    lte: report.endDate
                },
                status: 'COMPLETED'
            }
        });
        const reportData = {
            business: report.business,
            period: { startDate: report.startDate, endDate: report.endDate },
            summary: {
                totalTransactions: report.totalTransactions,
                totalRevenue: parseFloat(report.totalAmount?.toString() || '0'),
                totalTax: parseFloat(report.totalTax?.toString() || '0')
            },
            transactions
        };
        if (report.fileFormat === 'PDF') {
            const pdfBuffer = await generatePDFReport(reportData);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${report.name}.pdf"`);
            res.send(pdfBuffer);
        }
        else if (report.fileFormat === 'XLSX') {
            const excelBuffer = await generateExcelReport(reportData);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${report.name}.xlsx"`);
            res.send(excelBuffer);
        }
        else {
            res.json(reportData);
        }
    }
    catch (error) {
        console.error('Error downloading report:', error);
        res.status(500).json({ error: 'Failed to download report' });
    }
});
exports.default = router;
//# sourceMappingURL=reports.js.map
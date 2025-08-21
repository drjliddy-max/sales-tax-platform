"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedExportService = void 0;
const exceljs_1 = __importDefault(require("exceljs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const chartjs_node_canvas_1 = require("chartjs-node-canvas");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const writeFile = (0, util_1.promisify)(fs_1.default.writeFile);
const mkdir = (0, util_1.promisify)(fs_1.default.mkdir);
class AdvancedExportService {
    constructor(outputDir = './exports') {
        this.outputDir = outputDir;
        this.chartCanvas = new chartjs_node_canvas_1.ChartJSNodeCanvas({
            width: 800,
            height: 600,
            backgroundColour: 'white',
            chartCallback: (ChartJS) => {
                ChartJS.defaults.font.family = 'Arial, sans-serif';
                ChartJS.defaults.font.size = 12;
            }
        });
        this.ensureOutputDir();
    }
    async generatePDFReport(reportData, options = {}) {
        try {
            const baseFilename = options.filename || `${reportData.title.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
            const sanitizedFilename = path_1.default.basename(baseFilename).replace(/[^a-zA-Z0-9._-]/g, '');
            if (!sanitizedFilename || !sanitizedFilename.endsWith('.pdf')) {
                throw new Error('Invalid PDF filename');
            }
            const secureOutputDir = path_1.default.resolve(this.outputDir);
            const filePath = path_1.default.join(secureOutputDir, sanitizedFilename);
            if (!filePath.startsWith(secureOutputDir)) {
                throw new Error('Invalid file path - directory traversal detected');
            }
            const doc = new pdfkit_1.default({
                size: 'A4',
                margins: { top: 50, bottom: 50, left: 50, right: 50 },
                info: {
                    Title: reportData.title,
                    Author: reportData.companyName || 'Sales Tax Tracker',
                    Subject: `${reportData.title} - ${reportData.reportDate}`,
                    CreationDate: new Date()
                }
            });
            const stream = fs_1.default.createWriteStream(filePath);
            doc.pipe(stream);
            await this.addPDFHeader(doc, reportData, options.brandingEnabled);
            await this.addTableOfContents(doc, reportData.sections);
            for (let i = 0; i < reportData.sections.length; i++) {
                const section = reportData.sections[i];
                await this.addPDFSection(doc, section, i + 1);
            }
            if (options.includeCharts && reportData.charts && reportData.charts.length > 0) {
                await this.addChartsToPDF(doc, reportData.charts);
            }
            this.addPDFFooter(doc, reportData);
            doc.end();
            await new Promise((resolve, reject) => {
                stream.on('finish', resolve);
                stream.on('error', reject);
            });
            return { success: true, filePath };
        }
        catch (error) {
            console.error('Error generating PDF report:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
    async generateExcelReport(reportData, options = {}) {
        try {
            const baseFilename = options.filename || `${reportData.title.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
            const sanitizedFilename = path_1.default.basename(baseFilename).replace(/[^a-zA-Z0-9._-]/g, '');
            if (!sanitizedFilename || !sanitizedFilename.endsWith('.xlsx')) {
                throw new Error('Invalid Excel filename');
            }
            const secureOutputDir = path_1.default.resolve(this.outputDir);
            const filePath = path_1.default.join(secureOutputDir, sanitizedFilename);
            if (!filePath.startsWith(secureOutputDir)) {
                throw new Error('Invalid file path - directory traversal detected');
            }
            const workbook = new exceljs_1.default.Workbook();
            workbook.creator = reportData.companyName || 'Sales Tax Tracker';
            workbook.created = new Date();
            workbook.modified = new Date();
            workbook.lastPrinted = new Date();
            await this.addSummarySheet(workbook, reportData);
            for (const sheetConfig of reportData.sheets) {
                await this.addExcelSheet(workbook, sheetConfig, options.includeCharts);
            }
            this.applyWorkbookStyling(workbook);
            await workbook.xlsx.writeFile(filePath);
            return { success: true, filePath };
        }
        catch (error) {
            console.error('Error generating Excel report:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
    async generateChart(config) {
        const chartConfig = {
            type: config.type,
            data: config.data,
            options: {
                responsive: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                ...config.options
            }
        };
        return this.chartCanvas.renderToBuffer(chartConfig);
    }
    async addPDFHeader(doc, reportData, brandingEnabled = true) {
        const pageWidth = doc.page.width - 100;
        if (brandingEnabled && reportData.companyName) {
            doc.fontSize(24)
                .fillColor('#2563eb')
                .text(reportData.companyName, 50, 50, { align: 'left' });
        }
        doc.fontSize(20)
            .fillColor('#1f2937')
            .text(reportData.title, 50, brandingEnabled ? 90 : 50, {
            align: 'center',
            width: pageWidth
        });
        if (reportData.subtitle) {
            doc.fontSize(14)
                .fillColor('#6b7280')
                .text(reportData.subtitle, 50, doc.y + 10, {
                align: 'center',
                width: pageWidth
            });
        }
        doc.fontSize(12)
            .fillColor('#6b7280')
            .text(`Generated on ${reportData.reportDate}`, 50, doc.y + 15, {
            align: 'center',
            width: pageWidth
        });
        doc.moveTo(50, doc.y + 20)
            .lineTo(doc.page.width - 50, doc.y + 20)
            .strokeColor('#e5e7eb')
            .stroke();
        doc.y += 35;
    }
    async addTableOfContents(doc, sections) {
        doc.fontSize(16)
            .fillColor('#1f2937')
            .text('Table of Contents', 50, doc.y, { underline: true });
        doc.y += 20;
        sections.forEach((section, index) => {
            doc.fontSize(12)
                .fillColor('#374151')
                .text(`${index + 1}. ${section.title}`, 70, doc.y);
            doc.y += 18;
        });
        doc.y += 20;
    }
    async addPDFSection(doc, section, sectionNumber) {
        if (doc.y > doc.page.height - 200) {
            doc.addPage();
        }
        doc.fontSize(16)
            .fillColor('#1f2937')
            .text(`${sectionNumber}. ${section.title}`, 50, doc.y, { underline: true });
        doc.y += 25;
        switch (section.type) {
            case 'text':
                await this.addTextSection(doc, section.content);
                break;
            case 'table':
                await this.addTableSection(doc, section.content);
                break;
            case 'metrics':
                await this.addMetricsSection(doc, section.content);
                break;
        }
        doc.y += 30;
    }
    async addTextSection(doc, content) {
        doc.fontSize(11)
            .fillColor('#374151')
            .text(content, 50, doc.y, {
            width: doc.page.width - 100,
            align: 'left',
            lineGap: 3
        });
        doc.y += 15;
    }
    async addTableSection(doc, table) {
        const pageWidth = doc.page.width - 100;
        const colWidth = pageWidth / table.headers.length;
        let x = 50;
        doc.fontSize(10).fillColor('#1f2937');
        table.headers.forEach(header => {
            doc.rect(x, doc.y, colWidth, 25)
                .fillAndStroke('#f3f4f6', '#e5e7eb');
            doc.fillColor('#1f2937')
                .text(header, x + 5, doc.y + 8, {
                width: colWidth - 10,
                align: 'center'
            });
            x += colWidth;
        });
        doc.y += 25;
        table.rows.forEach(row => {
            x = 50;
            doc.fontSize(9).fillColor('#374151');
            row.forEach(cell => {
                doc.rect(x, doc.y, colWidth, 20)
                    .stroke('#e5e7eb');
                doc.text(String(cell), x + 5, doc.y + 6, {
                    width: colWidth - 10,
                    align: 'left'
                });
                x += colWidth;
            });
            doc.y += 20;
        });
        if (table.totals) {
            x = 50;
            doc.fontSize(10).fillColor('#1f2937');
            table.totals.forEach(total => {
                doc.rect(x, doc.y, colWidth, 22)
                    .fillAndStroke('#f9fafb', '#d1d5db');
                doc.fillColor('#1f2937')
                    .text(String(total), x + 5, doc.y + 7, {
                    width: colWidth - 10,
                    align: 'center'
                });
                x += colWidth;
            });
            doc.y += 22;
        }
    }
    async addMetricsSection(doc, metrics) {
        const metricsPerRow = 3;
        const metricWidth = (doc.page.width - 100) / metricsPerRow - 10;
        for (let i = 0; i < metrics.metrics.length; i += metricsPerRow) {
            let x = 50;
            for (let j = i; j < Math.min(i + metricsPerRow, metrics.metrics.length); j++) {
                const metric = metrics.metrics[j];
                doc.rect(x, doc.y, metricWidth, 60)
                    .fillAndStroke('#f8fafc', '#e2e8f0');
                doc.fontSize(9)
                    .fillColor('#6b7280')
                    .text(metric.label, x + 10, doc.y + 10, {
                    width: metricWidth - 20,
                    align: 'center'
                });
                doc.fontSize(16)
                    .fillColor('#1f2937')
                    .text(this.formatMetricValue(metric), x + 10, doc.y + 25, {
                    width: metricWidth - 20,
                    align: 'center'
                });
                if (metric.trend && metric.trendValue) {
                    const trendColor = metric.trend === 'up' ? '#059669' : metric.trend === 'down' ? '#dc2626' : '#6b7280';
                    const trendSymbol = metric.trend === 'up' ? '↗' : metric.trend === 'down' ? '↘' : '→';
                    doc.fontSize(10)
                        .fillColor(trendColor)
                        .text(`${trendSymbol} ${metric.trendValue}%`, x + 10, doc.y + 45, {
                        width: metricWidth - 20,
                        align: 'center'
                    });
                }
                x += metricWidth + 10;
            }
            doc.y += 80;
        }
    }
    async addChartsToPDF(doc, charts) {
        doc.addPage();
        doc.fontSize(16)
            .fillColor('#1f2937')
            .text('Charts and Visualizations', 50, 50, { underline: true });
        doc.y += 30;
        for (const chart of charts) {
            const chartBuffer = await this.generateChart(chart);
            if (chart.options?.plugins?.title?.text) {
                doc.fontSize(14)
                    .fillColor('#1f2937')
                    .text(chart.options.plugins.title.text, 50, doc.y, { align: 'center' });
                doc.y += 20;
            }
            doc.image(chartBuffer, 50, doc.y, {
                width: 500,
                align: 'center'
            });
            doc.y += 320;
        }
    }
    addPDFFooter(doc, reportData) {
        const pages = doc.bufferedPageRange();
        for (let i = pages.start; i < pages.start + pages.count; i++) {
            doc.switchToPage(i);
            doc.moveTo(50, doc.page.height - 80)
                .lineTo(doc.page.width - 50, doc.page.height - 80)
                .strokeColor('#e5e7eb')
                .stroke();
            doc.fontSize(9)
                .fillColor('#6b7280')
                .text(reportData.footer || 'Generated by Sales Tax Tracker', 50, doc.page.height - 65, { align: 'left' });
            doc.text(`Page ${i - pages.start + 1} of ${pages.count}`, 50, doc.page.height - 65, { align: 'right' });
        }
    }
    async addSummarySheet(workbook, reportData) {
        const sheet = workbook.addWorksheet('Summary', {
            properties: { tabColor: { argb: '2563eb' } }
        });
        sheet.mergeCells('A1:E1');
        const titleCell = sheet.getCell('A1');
        titleCell.value = reportData.title;
        titleCell.font = { size: 18, bold: true, color: { argb: '1f2937' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (reportData.companyName) {
            sheet.mergeCells('A2:E2');
            const companyCell = sheet.getCell('A2');
            companyCell.value = reportData.companyName;
            companyCell.font = { size: 14, color: { argb: '6b7280' } };
            companyCell.alignment = { horizontal: 'center' };
        }
        sheet.mergeCells('A3:E3');
        const dateCell = sheet.getCell('A3');
        dateCell.value = `Generated on ${reportData.reportDate}`;
        dateCell.font = { size: 12, color: { argb: '6b7280' } };
        dateCell.alignment = { horizontal: 'center' };
        let row = 5;
        sheet.getCell(`A${row}`).value = 'Report Contents:';
        sheet.getCell(`A${row}`).font = { bold: true, size: 14 };
        reportData.sheets.forEach((sheetConfig, index) => {
            row++;
            sheet.getCell(`A${row}`).value = `${index + 1}. ${sheetConfig.name}`;
            sheet.getCell(`B${row}`).value = `${sheetConfig.data.rows.length} records`;
        });
        sheet.columns.forEach(column => {
            if (column) {
                column.width = 20;
            }
        });
    }
    async addExcelSheet(workbook, sheetConfig, includeCharts = true) {
        const sheet = workbook.addWorksheet(sheetConfig.name);
        const data = sheetConfig.data;
        let currentRow = 1;
        if (data.metrics && data.metrics.length > 0) {
            sheet.mergeCells(`A${currentRow}:C${currentRow}`);
            const metricsHeaderCell = sheet.getCell(`A${currentRow}`);
            metricsHeaderCell.value = 'Key Metrics';
            metricsHeaderCell.font = { bold: true, size: 14 };
            metricsHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'f3f4f6' } };
            currentRow += 2;
            data.metrics.forEach(metric => {
                sheet.getCell(`A${currentRow}`).value = metric.label;
                sheet.getCell(`B${currentRow}`).value = this.formatMetricValue(metric);
                sheet.getCell(`B${currentRow}`).font = { bold: true };
                currentRow++;
            });
            currentRow += 2;
        }
        sheet.mergeCells(`A${currentRow}:${String.fromCharCode(65 + data.headers.length - 1)}${currentRow}`);
        const tableHeaderCell = sheet.getCell(`A${currentRow}`);
        tableHeaderCell.value = 'Detailed Data';
        tableHeaderCell.font = { bold: true, size: 14 };
        tableHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'f3f4f6' } };
        currentRow += 2;
        data.headers.forEach((header, index) => {
            const cell = sheet.getCell(currentRow, index + 1);
            cell.value = header;
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'e5e7eb' } };
            cell.border = {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
        currentRow++;
        data.rows.forEach(row => {
            row.forEach((cell, index) => {
                const excelCell = sheet.getCell(currentRow, index + 1);
                excelCell.value = cell;
                excelCell.border = {
                    top: { style: 'thin' },
                    bottom: { style: 'thin' },
                    left: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
            currentRow++;
        });
        if (data.totals && data.totals.length > 0) {
            data.totals.forEach((total, index) => {
                const cell = sheet.getCell(currentRow, index + 1);
                cell.value = total;
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'f9fafb' } };
                cell.border = {
                    top: { style: 'thick' },
                    bottom: { style: 'thin' },
                    left: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        }
        sheet.columns.forEach((column, index) => {
            if (column) {
                let maxLength = data.headers[index]?.length || 0;
                data.rows.forEach(row => {
                    const cellLength = String(row[index] || '').length;
                    if (cellLength > maxLength)
                        maxLength = cellLength;
                });
                column.width = Math.min(Math.max(maxLength + 2, 10), 30);
            }
        });
        if (includeCharts && sheetConfig.charts && sheetConfig.charts.length > 0) {
        }
    }
    applyWorkbookStyling(workbook) {
        workbook.eachSheet(sheet => {
            if (sheet.rowCount > 0) {
                const headerRow = sheet.getRow(1);
                headerRow.eachCell(cell => {
                    cell.font = { bold: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2563eb' } };
                });
            }
            sheet.pageSetup = {
                paperSize: 9,
                orientation: 'portrait',
                fitToPage: true,
                margins: {
                    left: 0.7,
                    right: 0.7,
                    top: 0.75,
                    bottom: 0.75,
                    header: 0.3,
                    footer: 0.3
                }
            };
        });
    }
    formatMetricValue(metric) {
        if (typeof metric.value === 'string') {
            return metric.value;
        }
        switch (metric.format) {
            case 'currency':
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                }).format(metric.value);
            case 'percentage':
                return `${(metric.value * 100).toFixed(1)}%`;
            case 'number':
                return new Intl.NumberFormat('en-US').format(metric.value);
            default:
                return String(metric.value);
        }
    }
    async ensureOutputDir() {
        try {
            await mkdir(this.outputDir, { recursive: true });
        }
        catch (error) {
            if (error.code !== 'EEXIST') {
                console.error('Error creating output directory:', error);
            }
        }
    }
    async cleanupOldFiles(maxAgeHours = 24) {
        try {
            const files = fs_1.default.readdirSync(this.outputDir);
            const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
            for (const file of files) {
                const filePath = path_1.default.join(this.outputDir, file);
                const stats = fs_1.default.statSync(filePath);
                if (stats.mtime.getTime() < cutoffTime) {
                    fs_1.default.unlinkSync(filePath);
                    console.log(`Cleaned up old file: ${file}`);
                }
            }
        }
        catch (error) {
            console.error('Error cleaning up old files:', error);
        }
    }
}
exports.AdvancedExportService = AdvancedExportService;
//# sourceMappingURL=AdvancedExportService.js.map
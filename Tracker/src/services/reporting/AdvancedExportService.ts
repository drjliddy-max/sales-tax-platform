import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'scatter' | 'bubble';
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
      fill?: boolean;
    }>;
  };
  options?: {
    responsive?: boolean;
    plugins?: {
      legend?: { display: boolean; position?: 'top' | 'bottom' | 'left' | 'right' };
      title?: { display: boolean; text: string };
    };
    scales?: {
      x?: { display: boolean; title?: { display: boolean; text: string } };
      y?: { display: boolean; title?: { display: boolean; text: string } };
    };
  };
}

export interface PDFReportData {
  title: string;
  subtitle?: string;
  companyName?: string;
  reportDate: string;
  sections: PDFSection[];
  charts?: ChartConfig[];
  footer?: string;
}

export interface PDFSection {
  title: string;
  content: string | PDFTable | PDFMetrics;
  type: 'text' | 'table' | 'metrics';
}

export interface PDFTable {
  headers: string[];
  rows: (string | number)[][];
  totals?: (string | number)[];
}

export interface PDFMetrics {
  metrics: Array<{
    label: string;
    value: string | number;
    format?: 'currency' | 'percentage' | 'number' | 'text';
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: number;
  }>;
}

export interface ExcelReportData {
  title: string;
  companyName?: string;
  reportDate: string;
  sheets: ExcelSheet[];
}

export interface ExcelSheet {
  name: string;
  data: ExcelSheetData;
  charts?: ChartConfig[];
}

export interface ExcelSheetData {
  headers: string[];
  rows: (string | number | Date | null)[][];
  metrics?: Array<{
    label: string;
    value: string | number;
    format?: 'currency' | 'percentage' | 'number' | 'text';
  }>;
  totals?: (string | number)[];
}

export interface ExportOptions {
  outputDir?: string;
  filename?: string;
  includeCharts?: boolean;
  brandingEnabled?: boolean;
  compression?: boolean;
}

export class AdvancedExportService {
  private chartCanvas: ChartJSNodeCanvas;
  private outputDir: string;

  constructor(outputDir = './exports') {
    this.outputDir = outputDir;
    this.chartCanvas = new ChartJSNodeCanvas({
      width: 800,
      height: 600,
      backgroundColour: 'white',
      chartCallback: (ChartJS) => {
        ChartJS.defaults.font.family = 'Arial, sans-serif';
        ChartJS.defaults.font.size = 12;
      }
    });

    // Ensure output directory exists
    this.ensureOutputDir();
  }

  /**
   * Generate enhanced PDF report with charts and professional styling
   */
  async generatePDFReport(
    reportData: PDFReportData,
    options: ExportOptions = {}
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      // Sanitize filename to prevent path traversal
      const baseFilename = options.filename || `${reportData.title.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      const sanitizedFilename = path.basename(baseFilename).replace(/[^a-zA-Z0-9._-]/g, '');
      
      if (!sanitizedFilename || !sanitizedFilename.endsWith('.pdf')) {
        throw new Error('Invalid PDF filename');
      }
      
      // Ensure output directory is secure
      const secureOutputDir = path.resolve(this.outputDir);
      const filePath = path.join(secureOutputDir, sanitizedFilename);
      
      // Verify the resolved path is within the output directory
      if (!filePath.startsWith(secureOutputDir)) {
        throw new Error('Invalid file path - directory traversal detected');
      }

      // Create PDF document with professional settings
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: reportData.title,
          Author: reportData.companyName || 'Sales Tax Tracker',
          Subject: `${reportData.title} - ${reportData.reportDate}`,
          CreationDate: new Date()
        }
      });

      // Stream to file
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Add company branding and header
      await this.addPDFHeader(doc, reportData, options.brandingEnabled);

      // Add table of contents
      await this.addTableOfContents(doc, reportData.sections);

      // Add sections with enhanced formatting
      for (let i = 0; i < reportData.sections.length; i++) {
        const section = reportData.sections[i];
        await this.addPDFSection(doc, section, i + 1);
      }

      // Add charts if requested and available
      if (options.includeCharts && reportData.charts && reportData.charts.length > 0) {
        await this.addChartsToPDF(doc, reportData.charts);
      }

      // Add footer
      this.addPDFFooter(doc, reportData);

      // Finalize PDF
      doc.end();

      // Wait for stream to close
      await new Promise<void>((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      return { success: true, filePath };

    } catch (error) {
      console.error('Error generating PDF report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Generate enhanced Excel workbook with multiple sheets and charts
   */
  async generateExcelReport(
    reportData: ExcelReportData,
    options: ExportOptions = {}
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      // Sanitize filename to prevent path traversal
      const baseFilename = options.filename || `${reportData.title.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
      const sanitizedFilename = path.basename(baseFilename).replace(/[^a-zA-Z0-9._-]/g, '');
      
      if (!sanitizedFilename || !sanitizedFilename.endsWith('.xlsx')) {
        throw new Error('Invalid Excel filename');
      }
      
      // Ensure output directory is secure
      const secureOutputDir = path.resolve(this.outputDir);
      const filePath = path.join(secureOutputDir, sanitizedFilename);
      
      // Verify the resolved path is within the output directory
      if (!filePath.startsWith(secureOutputDir)) {
        throw new Error('Invalid file path - directory traversal detected');
      }

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = reportData.companyName || 'Sales Tax Tracker';
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.lastPrinted = new Date();

      // Add summary sheet
      await this.addSummarySheet(workbook, reportData);

      // Add data sheets
      for (const sheetConfig of reportData.sheets) {
        await this.addExcelSheet(workbook, sheetConfig, options.includeCharts);
      }

      // Apply professional styling
      this.applyWorkbookStyling(workbook);

      // Write file
      await workbook.xlsx.writeFile(filePath);

      return { success: true, filePath };

    } catch (error) {
      console.error('Error generating Excel report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Generate chart as buffer for embedding in reports
   */
  async generateChart(config: ChartConfig): Promise<Buffer> {
    const chartConfig: ChartConfiguration = {
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

  /**
   * Add professional PDF header with branding
   */
  private async addPDFHeader(
    doc: PDFKit.PDFDocument,
    reportData: PDFReportData,
    brandingEnabled = true
  ): Promise<void> {
    const pageWidth = doc.page.width - 100; // Account for margins

    if (brandingEnabled && reportData.companyName) {
      // Company logo placeholder and name
      doc.fontSize(24)
        .fillColor('#2563eb')
        .text(reportData.companyName, 50, 50, { align: 'left' });
    }

    // Report title
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

    // Report date
    doc.fontSize(12)
      .fillColor('#6b7280')
      .text(`Generated on ${reportData.reportDate}`, 50, doc.y + 15, {
        align: 'center',
        width: pageWidth
      });

    // Add separator line
    doc.moveTo(50, doc.y + 20)
      .lineTo(doc.page.width - 50, doc.y + 20)
      .strokeColor('#e5e7eb')
      .stroke();

    doc.y += 35;
  }

  /**
   * Add table of contents to PDF
   */
  private async addTableOfContents(
    doc: PDFKit.PDFDocument,
    sections: PDFSection[]
  ): Promise<void> {
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

  /**
   * Add formatted section to PDF
   */
  private async addPDFSection(
    doc: PDFKit.PDFDocument,
    section: PDFSection,
    sectionNumber: number
  ): Promise<void> {
    // Check if we need a new page
    if (doc.y > doc.page.height - 200) {
      doc.addPage();
    }

    // Section title
    doc.fontSize(16)
      .fillColor('#1f2937')
      .text(`${sectionNumber}. ${section.title}`, 50, doc.y, { underline: true });

    doc.y += 25;

    switch (section.type) {
      case 'text':
        await this.addTextSection(doc, section.content as string);
        break;
      case 'table':
        await this.addTableSection(doc, section.content as PDFTable);
        break;
      case 'metrics':
        await this.addMetricsSection(doc, section.content as PDFMetrics);
        break;
    }

    doc.y += 30;
  }

  /**
   * Add text section to PDF
   */
  private async addTextSection(doc: PDFKit.PDFDocument, content: string): Promise<void> {
    doc.fontSize(11)
      .fillColor('#374151')
      .text(content, 50, doc.y, {
        width: doc.page.width - 100,
        align: 'left',
        lineGap: 3
      });

    doc.y += 15;
  }

  /**
   * Add table section to PDF
   */
  private async addTableSection(doc: PDFKit.PDFDocument, table: PDFTable): Promise<void> {
    const pageWidth = doc.page.width - 100;
    const colWidth = pageWidth / table.headers.length;

    // Table headers
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

    // Table rows
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

    // Totals row if provided
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

  /**
   * Add metrics section to PDF
   */
  private async addMetricsSection(doc: PDFKit.PDFDocument, metrics: PDFMetrics): Promise<void> {
    const metricsPerRow = 3;
    const metricWidth = (doc.page.width - 100) / metricsPerRow - 10;
    
    for (let i = 0; i < metrics.metrics.length; i += metricsPerRow) {
      let x = 50;
      
      for (let j = i; j < Math.min(i + metricsPerRow, metrics.metrics.length); j++) {
        const metric = metrics.metrics[j];
        
        // Metric box
        doc.rect(x, doc.y, metricWidth, 60)
          .fillAndStroke('#f8fafc', '#e2e8f0');
        
        // Metric label
        doc.fontSize(9)
          .fillColor('#6b7280')
          .text(metric.label, x + 10, doc.y + 10, {
            width: metricWidth - 20,
            align: 'center'
          });
        
        // Metric value
        doc.fontSize(16)
          .fillColor('#1f2937')
          .text(this.formatMetricValue(metric), x + 10, doc.y + 25, {
            width: metricWidth - 20,
            align: 'center'
          });
        
        // Trend indicator
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

  /**
   * Add charts to PDF
   */
  private async addChartsToPDF(doc: PDFKit.PDFDocument, charts: ChartConfig[]): Promise<void> {
    doc.addPage();
    
    doc.fontSize(16)
      .fillColor('#1f2937')
      .text('Charts and Visualizations', 50, 50, { underline: true });

    doc.y += 30;

    for (const chart of charts) {
      const chartBuffer = await this.generateChart(chart);
      
      // Add chart title if available
      if (chart.options?.plugins?.title?.text) {
        doc.fontSize(14)
          .fillColor('#1f2937')
          .text(chart.options.plugins.title.text, 50, doc.y, { align: 'center' });
        doc.y += 20;
      }

      // Add chart image
      doc.image(chartBuffer, 50, doc.y, {
        width: 500,
        align: 'center'
      });

      doc.y += 320; // Chart height + spacing
    }
  }

  /**
   * Add PDF footer
   */
  private addPDFFooter(doc: PDFKit.PDFDocument, reportData: PDFReportData): void {
    const pages = doc.bufferedPageRange();
    
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      
      // Footer line
      doc.moveTo(50, doc.page.height - 80)
        .lineTo(doc.page.width - 50, doc.page.height - 80)
        .strokeColor('#e5e7eb')
        .stroke();
      
      // Footer text
      doc.fontSize(9)
        .fillColor('#6b7280')
        .text(
          reportData.footer || 'Generated by Sales Tax Tracker',
          50,
          doc.page.height - 65,
          { align: 'left' }
        );
      
      // Page number
      doc.text(
        `Page ${i - pages.start + 1} of ${pages.count}`,
        50,
        doc.page.height - 65,
        { align: 'right' }
      );
    }
  }

  /**
   * Add summary sheet to Excel workbook
   */
  private async addSummarySheet(workbook: ExcelJS.Workbook, reportData: ExcelReportData): Promise<void> {
    const sheet = workbook.addWorksheet('Summary', {
      properties: { tabColor: { argb: '2563eb' } }
    });

    // Report header
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

    // Sheet overview
    let row = 5;
    sheet.getCell(`A${row}`).value = 'Report Contents:';
    sheet.getCell(`A${row}`).font = { bold: true, size: 14 };
    
    reportData.sheets.forEach((sheetConfig, index) => {
      row++;
      sheet.getCell(`A${row}`).value = `${index + 1}. ${sheetConfig.name}`;
      sheet.getCell(`B${row}`).value = `${sheetConfig.data.rows.length} records`;
    });

    // Auto-fit columns
    sheet.columns.forEach(column => {
      if (column) {
        column.width = 20;
      }
    });
  }

  /**
   * Add data sheet to Excel workbook
   */
  private async addExcelSheet(
    workbook: ExcelJS.Workbook,
    sheetConfig: ExcelSheet,
    includeCharts = true
  ): Promise<void> {
    const sheet = workbook.addWorksheet(sheetConfig.name);
    const data = sheetConfig.data;

    let currentRow = 1;

    // Add metrics section if available
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

    // Add data table
    sheet.mergeCells(`A${currentRow}:${String.fromCharCode(65 + data.headers.length - 1)}${currentRow}`);
    const tableHeaderCell = sheet.getCell(`A${currentRow}`);
    tableHeaderCell.value = 'Detailed Data';
    tableHeaderCell.font = { bold: true, size: 14 };
    tableHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'f3f4f6' } };
    
    currentRow += 2;

    // Headers
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

    // Data rows
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

    // Totals row if available
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

    // Auto-fit columns
    sheet.columns.forEach((column, index) => {
      if (column) {
        let maxLength = data.headers[index]?.length || 0;
        data.rows.forEach(row => {
          const cellLength = String(row[index] || '').length;
          if (cellLength > maxLength) maxLength = cellLength;
        });
        column.width = Math.min(Math.max(maxLength + 2, 10), 30);
      }
    });

    // Add charts if requested
    if (includeCharts && sheetConfig.charts && sheetConfig.charts.length > 0) {
      // Charts will be added to a separate Charts sheet to avoid complexity
      // This is a placeholder for future chart embedding functionality
    }
  }

  /**
   * Apply professional styling to workbook
   */
  private applyWorkbookStyling(workbook: ExcelJS.Workbook): void {
    workbook.eachSheet(sheet => {
      // Apply header styling to all sheets
      if (sheet.rowCount > 0) {
        const headerRow = sheet.getRow(1);
        headerRow.eachCell(cell => {
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2563eb' } };
        });
      }

      // Set print options
      sheet.pageSetup = {
        paperSize: 9, // A4
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

  /**
   * Format metric value based on type
   */
  private formatMetricValue(metric: {
    value: string | number;
    format?: 'currency' | 'percentage' | 'number' | 'text';
  }): string {
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

  /**
   * Ensure output directory exists
   */
  private async ensureOutputDir(): Promise<void> {
    try {
      await mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        console.error('Error creating output directory:', error);
      }
    }
  }

  /**
   * Clean up old files in output directory
   */
  async cleanupOldFiles(maxAgeHours = 24): Promise<void> {
    try {
      const files = fs.readdirSync(this.outputDir);
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);

      for (const file of files) {
        const filePath = path.join(this.outputDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up old file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old files:', error);
    }
  }
}
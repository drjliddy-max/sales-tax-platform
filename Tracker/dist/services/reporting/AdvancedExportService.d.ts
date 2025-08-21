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
            legend?: {
                display: boolean;
                position?: 'top' | 'bottom' | 'left' | 'right';
            };
            title?: {
                display: boolean;
                text: string;
            };
        };
        scales?: {
            x?: {
                display: boolean;
                title?: {
                    display: boolean;
                    text: string;
                };
            };
            y?: {
                display: boolean;
                title?: {
                    display: boolean;
                    text: string;
                };
            };
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
export declare class AdvancedExportService {
    private chartCanvas;
    private outputDir;
    constructor(outputDir?: string);
    generatePDFReport(reportData: PDFReportData, options?: ExportOptions): Promise<{
        success: boolean;
        filePath?: string;
        error?: string;
    }>;
    generateExcelReport(reportData: ExcelReportData, options?: ExportOptions): Promise<{
        success: boolean;
        filePath?: string;
        error?: string;
    }>;
    generateChart(config: ChartConfig): Promise<Buffer>;
    private addPDFHeader;
    private addTableOfContents;
    private addPDFSection;
    private addTextSection;
    private addTableSection;
    private addMetricsSection;
    private addChartsToPDF;
    private addPDFFooter;
    private addSummarySheet;
    private addExcelSheet;
    private applyWorkbookStyling;
    private formatMetricValue;
    private ensureOutputDir;
    cleanupOldFiles(maxAgeHours?: number): Promise<void>;
}
//# sourceMappingURL=AdvancedExportService.d.ts.map
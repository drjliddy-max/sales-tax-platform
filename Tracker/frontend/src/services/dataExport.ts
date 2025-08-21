export interface ExportOptions {
  format: 'csv' | 'pdf' | 'excel' | 'json';
  dateRange?: {
    start: string;
    end: string;
  };
  filters?: {
    posSystem?: string[];
    location?: string[];
    category?: string[];
    status?: string[];
    jurisdiction?: string[];
  };
  columns?: string[];
  includeMetadata?: boolean;
  batchSize?: number;
}

export interface ExportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalRecords: number;
  processedRecords: number;
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  error?: string;
}

export interface BatchProcessingOptions {
  chunkSize: number;
  delayBetweenChunks: number;
  maxRetries: number;
  onProgress?: (progress: number) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
  onError?: (error: Error, chunkIndex: number) => void;
}

class DataExportService {
  private readonly baseUrl = '/api';
  private readonly defaultBatchSize = 1000;
  private readonly maxConcurrentExports = 3;
  private readonly authToken: string;

  constructor() {
    this.authToken = localStorage.getItem('clerk-db-jwt') || '';
  }

  private getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Start an export job for large datasets
   */
  async startExportJob(
    dataType: 'transactions' | 'analytics' | 'compliance',
    options: ExportOptions
  ): Promise<ExportJob> {
    const response = await fetch(`${this.baseUrl}/export/start`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        dataType,
        options: {
          ...options,
          batchSize: options.batchSize || this.defaultBatchSize
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Export job creation failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get the status of an export job
   */
  async getExportJobStatus(jobId: string): Promise<ExportJob> {
    const response = await fetch(`${this.baseUrl}/export/status/${jobId}`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get export status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Poll export job until completion
   */
  async pollExportJob(
    jobId: string,
    onProgress?: (job: ExportJob) => void,
    pollInterval: number = 2000
  ): Promise<ExportJob> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const job = await this.getExportJobStatus(jobId);
          
          if (onProgress) {
            onProgress(job);
          }

          if (job.status === 'completed') {
            resolve(job);
          } else if (job.status === 'failed') {
            reject(new Error(job.error || 'Export job failed'));
          } else {
            setTimeout(poll, pollInterval);
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  /**
   * Download the result of a completed export job
   */
  async downloadExportResult(job: ExportJob): Promise<void> {
    if (!job.downloadUrl) {
      throw new Error('Download URL not available');
    }

    const response = await fetch(job.downloadUrl, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.getFileName(job);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Quick export for small datasets (synchronous)
   */
  async quickExport(
    dataType: 'transactions' | 'analytics' | 'compliance',
    options: ExportOptions
  ): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/export/quick`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        dataType,
        options
      })
    });

    if (!response.ok) {
      throw new Error(`Quick export failed: ${response.statusText}`);
    }

    return response.blob();
  }

  /**
   * Batch process large datasets with chunking
   */
  async batchProcess<T, R>(
    data: T[],
    processor: (chunk: T[]) => Promise<R[]>,
    options: BatchProcessingOptions
  ): Promise<R[]> {
    const {
      chunkSize,
      delayBetweenChunks,
      maxRetries,
      onProgress,
      onChunkComplete,
      onError
    } = options;

    const chunks = this.chunkArray(data, chunkSize);
    const results: R[] = [];
    let processedChunks = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let retries = 0;

      while (retries <= maxRetries) {
        try {
          const chunkResults = await processor(chunk);
          results.push(...chunkResults);
          
          processedChunks++;
          
          if (onProgress) {
            onProgress((processedChunks / chunks.length) * 100);
          }
          
          if (onChunkComplete) {
            onChunkComplete(i + 1, chunks.length);
          }

          // Add delay between chunks to prevent overwhelming the server
          if (i < chunks.length - 1 && delayBetweenChunks > 0) {
            await this.delay(delayBetweenChunks);
          }

          break; // Success, exit retry loop
        } catch (error) {
          retries++;
          
          if (onError) {
            onError(error as Error, i);
          }

          if (retries > maxRetries) {
            throw new Error(`Batch processing failed at chunk ${i + 1}: ${error}`);
          }

          // Exponential backoff for retries
          await this.delay(Math.pow(2, retries) * 1000);
        }
      }
    }

    return results;
  }

  /**
   * Get available export formats for a data type
   */
  async getAvailableFormats(dataType: string): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/export/formats/${dataType}`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get export formats: ${response.statusText}`);
    }

    const data = await response.json();
    return data.formats;
  }

  /**
   * Get export templates for a specific format
   */
  async getExportTemplate(
    dataType: string,
    format: string
  ): Promise<{ columns: string[]; sampleData: any[] }> {
    const response = await fetch(`${this.baseUrl}/export/template/${dataType}/${format}`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get export template: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Cancel an ongoing export job
   */
  async cancelExportJob(jobId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/export/cancel/${jobId}`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel export job: ${response.statusText}`);
    }
  }

  /**
   * Get export history
   */
  async getExportHistory(limit: number = 50): Promise<ExportJob[]> {
    const response = await fetch(`${this.baseUrl}/export/history?limit=${limit}`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get export history: ${response.statusText}`);
    }

    const data = await response.json();
    return data.jobs;
  }

  /**
   * Validate export options
   */
  validateExportOptions(options: ExportOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!options.format) {
      errors.push('Export format is required');
    }

    if (options.format && !['csv', 'pdf', 'excel', 'json'].includes(options.format)) {
      errors.push('Invalid export format');
    }

    if (options.dateRange) {
      const start = new Date(options.dateRange.start);
      const end = new Date(options.dateRange.end);
      
      if (start > end) {
        errors.push('Start date must be before end date');
      }
      
      const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
      if (end.getTime() - start.getTime() > maxRange) {
        errors.push('Date range cannot exceed 1 year');
      }
    }

    if (options.batchSize && (options.batchSize < 100 || options.batchSize > 10000)) {
      errors.push('Batch size must be between 100 and 10,000');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Helper method to chunk arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Helper method to add delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate appropriate filename for export
   */
  private getFileName(job: ExportJob): string {
    const timestamp = new Date(job.createdAt).toISOString().split('T')[0];
    const extension = this.getFileExtension(job);
    return `export-${timestamp}.${extension}`;
  }

  /**
   * Get file extension based on export format
   */
  private getFileExtension(job: ExportJob): string {
    // This would be determined from job metadata in a real implementation
    return 'csv'; // Default fallback
  }

  /**
   * Format data for CSV export
   */
  formatForCSV(data: any[], columns?: string[]): string {
    if (data.length === 0) {
      return '';
    }

    const selectedColumns = columns || Object.keys(data[0]);
    const header = selectedColumns.join(',');
    
    const rows = data.map(row => 
      selectedColumns.map(col => {
        const value = row[col];
        // Handle CSV escaping
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    );

    return [header, ...rows].join('\n');
  }

  /**
   * Estimate export size for large datasets
   */
  async estimateExportSize(
    dataType: string,
    options: ExportOptions
  ): Promise<{ estimatedRows: number; estimatedSize: string; processingTime: string }> {
    const response = await fetch(`${this.baseUrl}/export/estimate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        dataType,
        options
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to estimate export size: ${response.statusText}`);
    }

    return response.json();
  }
}

export const dataExportService = new DataExportService();
export default dataExportService;

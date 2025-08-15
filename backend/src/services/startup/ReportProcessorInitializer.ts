import { reportProcessor, ReportProcessor } from '../reporting/ReportProcessor';

export class ReportProcessorInitializer {
  private static instance: ReportProcessorInitializer;
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): ReportProcessorInitializer {
    if (!ReportProcessorInitializer.instance) {
      ReportProcessorInitializer.instance = new ReportProcessorInitializer();
    }
    return ReportProcessorInitializer.instance;
  }

  /**
   * Initialize and start the report processor
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('⚠️ Report processor already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing Report Processor...');

      // Check if report processing is enabled
      const isEnabled = process.env.ENABLE_REPORT_PROCESSING !== 'false';
      
      if (!isEnabled) {
        console.log('ℹ️ Report processing disabled by environment variable');
        return;
      }

      // Start the report processor
      reportProcessor.start();

      // Log initial status
      const status = reportProcessor.getStatus();
      console.log('📊 Report Processor Status:', status);

      this.initialized = true;
      console.log('✅ Report Processor initialized successfully');

      // Set up graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('❌ Failed to initialize Report Processor:', error);
      throw error;
    }
  }

  /**
   * Get the report processor instance
   */
  public getProcessor(): ReportProcessor {
    return reportProcessor;
  }

  /**
   * Check if the processor is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Shutdown the report processor gracefully
   */
  public async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      console.log('🛑 Shutting down Report Processor...');
      
      // Stop the processor
      reportProcessor.stop();
      
      this.initialized = false;
      console.log('✅ Report Processor shutdown completed');
      
    } catch (error) {
      console.error('❌ Error during Report Processor shutdown:', error);
      throw error;
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdownHandler = async (signal: string) => {
      console.log(`📡 Received ${signal}, initiating graceful shutdown...`);
      
      try {
        await this.shutdown();
        process.exit(0);
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    // Handle various shutdown signals
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGQUIT', () => shutdownHandler('SIGQUIT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception in Report Processor:', error);
      shutdownHandler('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection in Report Processor:', reason, 'at', promise);
      shutdownHandler('unhandledRejection');
    });
  }
}

// Export singleton instance
export const reportProcessorInitializer = ReportProcessorInitializer.getInstance();
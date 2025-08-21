// Core Infrastructure
export * from './types';
export { POSDetector } from './detection';
export { TaxDataTransformer } from './transformer';
export { ConfigurationManager } from './configuration';
export { RateLimitManager } from './rate-limiter';

// Week 3-4: Primary POS Integration
export { WebhookManager } from './webhook-manager';
export { ErrorHandler } from './error-handler';

// POS Adapters
export { SquareIntegration } from './SquareIntegration';
export { ShopifyAdapter } from './adapters/ShopifyAdapter';
export { SquareAdapter } from './adapters/SquareAdapter';

// Future POS Integration Framework
export {
  POSIntegrationFactory,
  IntegrationGuide,
  IntegrationExamples,
  type POSIntegrationTemplate,
  type IntegrationChecklist
} from './integration-framework';

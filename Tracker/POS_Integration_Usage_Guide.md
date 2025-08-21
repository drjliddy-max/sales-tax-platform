# POS Integration Usage Guide

This guide demonstrates how to use the comprehensive POS integration framework to add new point-of-sale systems to your sales tax tracking application.

## 🎉 **Completed Features (Week 1-4)**

### ✅ **Week 1-2: Core Infrastructure** - **COMPLETED**
- **🔍 POS Detection**: Automatic fingerprinting and system identification
- **🔄 Data Transformation**: Universal tax data standardization
- **🔒 Configuration Management**: Encrypted credential storage with caching
- **⚡ Rate Limiting**: Adaptive request management with exponential backoff

### ✅ **Week 3-4: Primary POS Integration** - **COMPLETED**
- **🏪 Shopify Integration**: Complete OAuth, webhooks, multi-location support
- **🔲 Square Integration**: Enhanced integration with payment and order data
- **📡 Webhook Management**: Automatic subscription, validation, and retry logic
- **🔧 Error Handling**: Comprehensive error management and recovery system
- **🛠️ Integration Framework**: Systematic process for adding future POS systems

## 🚀 **Quick Start: Adding a New POS Integration**

### Step 1: Define Your POS Integration Template

```typescript
import { POSIntegrationTemplate, IntegrationExamples } from '@/integrations/pos';

// Example: Adding Clover POS
const cloverTemplate: POSIntegrationTemplate = IntegrationExamples.getCloverExample();

// Or create custom template
const customTemplate: POSIntegrationTemplate = {
  posType: 'my_pos',
  name: 'My POS System',
  description: 'Custom POS integration',
  marketFocus: 'Small businesses',
  supportedFeatures: [
    'Tax Calculation',
    'Multi-location',
    'Real-time Updates'
  ],
  authMethod: 'oauth',
  baseUrl: 'https://api.mypos.com/v1',
  testEndpoints: ['/health', '/merchants'],
  responseSignature: 'X-MyPOS-Version',
  rateLimit: {
    requestsPerSecond: 10,
    requestsPerMinute: 600,
    burstLimit: 20
  },
  taxDataSchema: {
    totalTaxField: 'total_tax',
    taxLinesField: 'tax_breakdown',
    taxRateField: 'rate',
    taxAmountField: 'amount',
    locationField: 'store_id',
    transactionIdField: 'transaction_id',
    timestampField: 'created_at',
    totalAmountField: 'total_amount',
    lineItemsField: 'items',
    statusField: 'status'
  },
  webhookEvents: [
    'transaction.created',
    'transaction.updated',
    'payment.completed'
  ],
  requiredCredentials: ['accessToken', 'merchantId'],
  oauthScopes: ['read:transactions', 'read:locations']
};
```

### Step 2: Generate Adapter Code

```typescript
import { POSIntegrationFactory } from '@/integrations/pos';

// Generate the adapter implementation
const adapterCode = POSIntegrationFactory.generateAdapter(customTemplate);

// Generate the test file
const testCode = POSIntegrationFactory.generateAdapterTest(customTemplate);

// Save to files
writeFileSync('./src/integrations/pos/adapters/MyPOSAdapter.ts', adapterCode);
writeFileSync('./src/integrations/pos/adapters/__tests__/MyPOSAdapter.test.ts', testCode);
```

### Step 3: Implement Specific Business Logic

After generating the base adapter, customize the implementation:

```typescript
// src/integrations/pos/adapters/MyPOSAdapter.ts

export class MyPOSAdapter implements POSAdapter {
  // ... generated code ...

  /**
   * Custom implementation for MyPOS-specific authentication
   */
  public async authenticate(credentials: AuthCredentials): Promise<AuthCredentials> {
    // Implement MyPOS-specific OAuth flow
    const response = await this.makeRequest('/oauth/token', 'POST', credentials);
    
    return {
      ...credentials,
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      customCredentials: {
        merchantId: response.data.merchant_id,
        storeCount: response.data.store_count
      }
    };
  }

  /**
   * Transform MyPOS data to standardized format
   */
  protected transformTransaction(transaction: any): StandardizedTaxData {
    // Custom transformation logic specific to MyPOS data structure
    return this.transformer.transform({
      ...transaction,
      // Map MyPOS-specific fields
      total_tax: transaction.tax_total,
      tax_breakdown: transaction.taxes,
      store_id: transaction.location_id
    });
  }
}
```

### Step 4: Test Your Integration

```typescript
// Run the comprehensive test suite
import { IntegrationGuide } from '@/integrations/pos';

const checklist = IntegrationGuide.getTestingChecklist();
console.log('Testing Checklist:', checklist);

// Test with real credentials (sandbox)
const adapter = new MyPOSAdapter();
const testResult = await adapter.testConnection({
  type: 'oauth',
  accessToken: 'sandbox_token',
  merchantId: 'test_merchant'
});

console.log('Connection test:', testResult);
```

### Step 5: Register the Integration

```typescript
import { POSIntegrationFactory, WebhookManager } from '@/integrations/pos';

// Register the new adapter
await POSIntegrationFactory.registerAdapter('my_pos', adapter, customTemplate);

// The system now automatically:
// - Adds detection fingerprints
// - Registers webhook handlers
// - Updates configuration templates
// - Enables automatic discovery
```

## 📋 **Development Checklist**

Use the built-in checklist system to track progress:

```typescript
import { POSIntegrationFactory } from '@/integrations/pos';

const checklist = POSIntegrationFactory.createIntegrationChecklist('my_pos');

// Update checklist as you complete each step
checklist.adapterImplemented = true;
checklist.authenticationTested = true;
// ... continue updating ...

// Validate completeness
const validation = POSIntegrationFactory.validateIntegration('my_pos', adapter, checklist);
if (!validation.isValid) {
  console.log('Missing items:', validation.missingItems);
}
```

## 🔧 **Usage Examples**

### Automatic POS Detection

```typescript
import { POSDetector } from '@/integrations/pos';

// The system automatically detects POS type from credentials
const credentials = { accessToken: 'token', shopDomain: 'shop.myshopify.com' };
const detection = await POSDetector.detectPOSSystem(credentials);

console.log(`Detected: ${detection.posType} with ${detection.confidence * 100}% confidence`);
console.log('Supported features:', detection.supportedFeatures);
```

### Webhook Processing

```typescript
import { WebhookManager } from '@/integrations/pos';

const webhookManager = WebhookManager.getInstance();

// Automatically handles webhooks from any registered POS
app.post('/webhooks/:posType', async (req, res) => {
  const { posType } = req.params;
  const signature = req.headers['x-signature'];
  
  const result = await webhookManager.processWebhook(
    posType,
    'transaction.created',
    req.body,
    signature,
    req.user.businessId
  );
  
  res.json(result);
});

// Listen for processed events
webhookManager.on('webhook:received', (event) => {
  console.log(`Processed ${event.posType} webhook:`, event.data);
});
```

### Error Handling

```typescript
import { ErrorHandler } from '@/integrations/pos';

const errorHandler = ErrorHandler.getInstance();

// Automatically handles errors with recovery strategies
try {
  await adapter.getTransactions(credentials, locationId, startDate, endDate);
} catch (error) {
  await errorHandler.handleError(error, {
    businessId: 'business_123',
    operation: 'getTransactions',
    posType: 'my_pos',
    timestamp: new Date()
  });
}

// Monitor error patterns
errorHandler.on('error:pattern_detected', (data) => {
  console.log('Error pattern detected:', data.pattern);
  console.log('Suggested resolution:', data.pattern.resolutionStrategy);
});
```

### Configuration Management

```typescript
import { ConfigurationManager } from '@/integrations/pos';

// Secure credential storage with encryption
const config: POSConfiguration = {
  posType: 'my_pos',
  credentials: { accessToken: 'secret_token' },
  webhookEndpoints: ['/webhooks/my_pos'],
  dataSchema: customTemplate.taxDataSchema,
  rateLimit: customTemplate.rateLimit,
  isActive: true
};

await ConfigurationManager.saveConfiguration('business_123', config);

// Automatic caching and decryption
const loadedConfig = await ConfigurationManager.loadConfiguration('business_123', 'my_pos');
```

## 🚀 **Advanced Usage**

### Custom Data Transformation

```typescript
import { TaxDataTransformer } from '@/integrations/pos';

// Create custom transformer for complex data structures
const transformer = new TaxDataTransformer('my_pos', {
  // ... schema mapping ...
});

// Transform with custom logic
const standardizedData = transformer.transform(rawPOSData);
```

### Rate Limiting

```typescript
import { RateLimitManager } from '@/integrations/pos';

const rateLimiter = RateLimitManager.getInstance();

// Automatic rate limiting with retry logic
const result = await rateLimiter.executeRequest('my_pos', async () => {
  return await apiCall();
}, 1 /* priority */);
```

## 📊 **Monitoring and Analytics**

### Health Monitoring

```typescript
// Get real-time health metrics
const healthMetrics = errorHandler.getHealthMetrics();
healthMetrics.forEach(metric => {
  console.log(`${metric.posType}: ${metric.connectionStatus}`);
  console.log(`Success rate: ${metric.successRate}%`);
});

// Webhook statistics
const webhookStats = await webhookManager.getWebhookStats();
console.log('Active subscriptions:', webhookStats.activeSubscriptions);
console.log('Recently processed:', webhookStats.recentlyProcessed);
```

### Error Analytics

```typescript
// Get comprehensive error statistics
const errorStats = await errorHandler.getErrorStats();
console.log('Total errors (24h):', errorStats.totalErrors);
console.log('Errors by POS:', errorStats.errorsByPOS);
console.log('Recovery success rate:', errorStats.recoveryActions.successful / errorStats.recoveryActions.total);
```

## 🎯 **Next Steps**

With Week 3-4 completed, the foundation is solid. The framework provides:

1. **🔍 Automatic Detection** - No manual POS type selection needed
2. **🔄 Universal Transformation** - Consistent tax data across all systems  
3. **🔒 Secure Storage** - Encrypted credentials with intelligent caching
4. **⚡ Smart Rate Limiting** - Respects each POS system's limits automatically
5. **📡 Webhook Management** - Real-time updates with retry logic
6. **🔧 Error Recovery** - Automatic recovery strategies and health monitoring
7. **🛠️ Easy Extension** - Template-driven approach for new integrations

The system is now ready to scale to any number of POS integrations while maintaining reliability, security, and performance.

## 📚 **Common Integration Patterns**

### Pattern 1: OAuth with Refresh Tokens
```typescript
// Handle token refresh automatically
if (error.code === 'AUTH_ERROR' && credentials.refreshToken) {
  const newTokens = await this.refreshTokens(credentials);
  // Retry with new tokens
}
```

### Pattern 2: Paginated Data Fetching
```typescript
// Handle pagination consistently
let allTransactions = [];
let cursor = null;

do {
  const response = await this.fetchPage(cursor);
  allTransactions.push(...response.data);
  cursor = response.nextCursor;
} while (cursor);
```

### Pattern 3: Multi-Location Support
```typescript
// Process multiple locations efficiently
const locations = await adapter.getLocations(credentials);
const transactionPromises = locations.map(location => 
  adapter.getTransactions(credentials, location.id, startDate, endDate)
);

const allTransactions = await Promise.all(transactionPromises);
```

This comprehensive framework ensures consistent, reliable, and scalable POS integrations for your sales tax tracking application! 🚀

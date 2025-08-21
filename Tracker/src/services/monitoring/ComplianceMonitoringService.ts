import { sentryService } from './SentryService';
import { logger } from '@/utils';
import { Transaction, Business, TaxRate } from '@/models';

interface ComplianceCheck {
  type: 'accuracy' | 'filing' | 'rate_compliance' | 'threshold_monitoring';
  businessId: string;
  jurisdiction: string;
  status: 'pass' | 'warning' | 'fail';
  score: number; // 0-1 scale
  details: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

interface FilingRequirement {
  businessId: string;
  jurisdiction: string;
  filingPeriod: 'monthly' | 'quarterly' | 'annual';
  dueDate: Date;
  status: 'pending' | 'filed' | 'overdue';
  taxOwed: number;
  penaltyRisk: 'low' | 'medium' | 'high';
}

interface AuditTrail {
  entityType: 'transaction' | 'tax_rate' | 'business' | 'filing';
  entityId: string;
  action: 'created' | 'updated' | 'deleted' | 'calculated';
  userId?: string;
  businessId: string;
  changes: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  jurisdiction?: string;
}

export class ComplianceMonitoringService {
  private static instance: ComplianceMonitoringService;
  private complianceCache = new Map<string, ComplianceCheck>();
  private auditTrail: AuditTrail[] = [];
  private filingRequirements = new Map<string, FilingRequirement>();

  private constructor() {
    this.startComplianceMonitoring();
  }

  public static getInstance(): ComplianceMonitoringService {
    if (!ComplianceMonitoringService.instance) {
      ComplianceMonitoringService.instance = new ComplianceMonitoringService();
    }
    return ComplianceMonitoringService.instance;
  }

  public async performComplianceCheck(check: Omit<ComplianceCheck, 'timestamp'>): Promise<string> {
    const transaction = sentryService.startTransaction(
      `compliance_check_${check.type}`,
      'compliance.check',
      {
        businessId: check.businessId,
        jurisdiction: check.jurisdiction,
        checkType: check.type
      }
    );

    try {
      const timestamp = new Date();
      const fullCheck: ComplianceCheck = {
        ...check,
        timestamp
      };

      // Store compliance check
      const checkKey = `${check.businessId}_${check.jurisdiction}_${check.type}`;
      this.complianceCache.set(checkKey, fullCheck);

      // Track in Sentry
      sentryService.trackComplianceWorkflow({
        type: this.mapCheckTypeToWorkflow(check.type),
        businessId: check.businessId,
        jurisdiction: check.jurisdiction,
        status: check.status === 'pass' ? 'completed' : 'failed',
        complianceScore: check.score
      });

      // Create alerts for failed checks
      if (check.status === 'fail' || check.score < 0.7) {
        const alertId = sentryService.createComplianceAlert({
          type: check.type === 'accuracy' ? 'accuracy' : 'threshold',
          severity: check.score < 0.5 ? 'critical' : check.score < 0.7 ? 'high' : 'medium',
          businessId: check.businessId,
          jurisdiction: check.jurisdiction,
          message: `Compliance check failed: ${check.details}`,
          metadata: {
            check_type: check.type,
            score: check.score,
            details: check.details,
            ...check.metadata
          },
          timestamp
        });

        logger.warn('Compliance check failed', {
          alertId,
          businessId: check.businessId,
          type: check.type,
          score: check.score
        });
      }

      transaction.setAttribute('check_type', check.type);
      transaction.setAttribute('status', check.status);
      transaction.setAttribute('score', check.score.toString());
      transaction.end();

      return checkKey;

    } catch (error) {
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Compliance check failed'),
        {
          businessId: check.businessId,
          jurisdiction: check.jurisdiction,
          severity: 'high'
        }
      );

      transaction.setAttribute('error', 'true');
      transaction.end();
      throw error;
    }
  }

  public async auditTaxCalculation(
    transactionId: string,
    calculatedTax: number,
    expectedTax?: number,
    businessId?: string
  ): Promise<void> {
    try {
      // Perform accuracy audit
      let accuracyScore = 1.0;
      let status: 'pass' | 'warning' | 'fail' = 'pass';
      let details = 'Tax calculation accurate';

      if (expectedTax !== undefined) {
        const variance = Math.abs(calculatedTax - expectedTax) / expectedTax;
        
        if (variance > 0.1) { // More than 10% variance
          status = 'fail';
          accuracyScore = Math.max(0, 1 - variance);
          details = `Tax calculation variance: ${(variance * 100).toFixed(2)}%`;
        } else if (variance > 0.05) { // More than 5% variance
          status = 'warning';
          accuracyScore = 0.8;
          details = `Tax calculation variance: ${(variance * 100).toFixed(2)}%`;
        }
      }

      // Get transaction details for context
      const transaction = await Transaction.findById(transactionId);
      const jurisdiction = transaction ? 
        `${transaction.address?.city || 'Unknown'}, ${transaction.address?.state || 'Unknown'}` :
        'Unknown';

      await this.performComplianceCheck({
        type: 'accuracy',
        businessId: businessId || transaction?.businessId || 'default',
        jurisdiction,
        status,
        score: accuracyScore,
        details,
        metadata: {
          transaction_id: transactionId,
          calculated_tax: calculatedTax,
          expected_tax: expectedTax,
          variance: expectedTax ? Math.abs(calculatedTax - expectedTax) / expectedTax : 0
        }
      });

    } catch (error) {
      logger.error('Error during tax calculation audit:', error);
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Tax calculation audit failed'),
        {
          businessId,
          transactionId,
          severity: 'medium'
        }
      );
    }
  }

  public logAuditEvent(event: AuditTrail): void {
    // Add to local audit trail
    this.auditTrail.push(event);
    
    // Keep only last 1000 audit events in memory
    if (this.auditTrail.length > 1000) {
      this.auditTrail = this.auditTrail.slice(-1000);
    }

    // Track in Sentry for compliance monitoring
    sentryService.addBreadcrumb(
      'audit_trail',
      `${event.action} ${event.entityType}`,
      'info',
      {
        entity_type: event.entityType,
        entity_id: event.entityId,
        action: event.action,
        business_id: event.businessId,
        user_id: event.userId,
        jurisdiction: event.jurisdiction,
        change_count: Object.keys(event.changes).length
      }
    );

    // Alert on sensitive operations
    if (event.entityType === 'tax_rate' && (event.action === 'updated' || event.action === 'deleted')) {
      sentryService.createComplianceAlert({
        type: 'rate_change',
        severity: 'medium',
        businessId: event.businessId,
        jurisdiction: event.jurisdiction || 'System',
        message: `Tax rate ${event.action}: ${event.entityId}`,
        metadata: {
          entity_type: event.entityType,
          action: event.action,
          user_id: event.userId,
          changes: event.changes
        },
        timestamp: event.timestamp
      });
    }
  }

  public async monitorFilingRequirements(): Promise<void> {
    const transaction = sentryService.startTransaction(
      'filing_requirements_check',
      'compliance.filing',
      {}
    );

    try {
      // Get all active businesses
      const businesses = await Business.find({ status: 'active' });
      
      for (const business of businesses) {
        const businessSpan = sentryService.createSpan(
          transaction,
          'business_filing_check',
          `Check filing for ${business.name}`
        );

        try {
          await this.checkBusinessFilingRequirements(business._id.toString());
        } catch (error) {
          sentryService.captureFinancialError(
            error instanceof Error ? error : new Error('Filing requirement check failed'),
            {
              businessId: business._id.toString(),
              severity: 'high'
            }
          );
        }

        businessSpan.end();
      }

      transaction.end();

    } catch (error) {
      transaction.setAttribute('error', 'true');
      transaction.end();
      throw error;
    }
  }

  private async checkBusinessFilingRequirements(businessId: string): Promise<void> {
    // Simulate filing requirement check
    // In production, this would check actual filing deadlines and tax owed

    const mockRequirement: FilingRequirement = {
      businessId,
      jurisdiction: 'CA',
      filingPeriod: 'monthly',
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
      status: 'pending',
      taxOwed: 1500.00,
      penaltyRisk: 'low'
    };

    this.filingRequirements.set(`${businessId}_CA`, mockRequirement);

    // Alert if due date is approaching
    const daysUntilDue = (mockRequirement.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    
    if (daysUntilDue <= 7) {
      sentryService.createComplianceAlert({
        type: 'filing',
        severity: daysUntilDue <= 3 ? 'critical' : 'high',
        businessId,
        jurisdiction: mockRequirement.jurisdiction,
        message: `Tax filing due in ${Math.ceil(daysUntilDue)} days`,
        metadata: {
          filing_period: mockRequirement.filingPeriod,
          due_date: mockRequirement.dueDate.toISOString(),
          tax_owed: mockRequirement.taxOwed,
          penalty_risk: mockRequirement.penaltyRisk
        },
        timestamp: new Date()
      });
    }
  }

  public async detectTaxCalculationAnomalies(businessId: string): Promise<void> {
    const transaction = sentryService.startTransaction(
      'anomaly_detection',
      'compliance.anomaly',
      { businessId }
    );

    try {
      // Get recent transactions for analysis
      const recentTransactions = await Transaction.find({
        businessId,
        createdAt: {
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }).limit(1000);

      if (recentTransactions.length < 10) {
        transaction.end();
        return; // Not enough data for anomaly detection
      }

      // Calculate average tax rate
      const totalRevenue = recentTransactions.reduce((sum, t) => sum + (t.subtotal || 0), 0);
      const totalTax = recentTransactions.reduce((sum, t) => sum + (t.totalTax || 0), 0);
      const avgTaxRate = totalRevenue > 0 ? totalTax / totalRevenue : 0;

      // Detect anomalies
      const anomalies = recentTransactions.filter(transaction => {
        if (!transaction.subtotal || !transaction.totalTax) return false;
        
        const transactionTaxRate = transaction.totalTax / transaction.subtotal;
        const deviation = Math.abs(transactionTaxRate - avgTaxRate) / avgTaxRate;
        
        return deviation > 0.5; // 50% deviation from average
      });

      if (anomalies.length > 0) {
        sentryService.createComplianceAlert({
          type: 'anomaly',
          severity: anomalies.length > 10 ? 'critical' : 'medium',
          businessId,
          jurisdiction: 'Multiple',
          message: `${anomalies.length} tax calculation anomalies detected`,
          metadata: {
            anomaly_count: anomalies.length,
            total_transactions: recentTransactions.length,
            avg_tax_rate: avgTaxRate,
            anomaly_transaction_ids: anomalies.slice(0, 5).map(t => t._id.toString())
          },
          timestamp: new Date()
        });
      }

      // Track compliance score
      const complianceScore = 1 - (anomalies.length / recentTransactions.length);
      
      await this.performComplianceCheck({
        type: 'accuracy',
        businessId,
        jurisdiction: 'System-wide',
        status: complianceScore > 0.95 ? 'pass' : complianceScore > 0.9 ? 'warning' : 'fail',
        score: complianceScore,
        details: `${anomalies.length} anomalies in ${recentTransactions.length} transactions`,
        metadata: {
          avg_tax_rate: avgTaxRate,
          anomaly_count: anomalies.length,
          total_transactions: recentTransactions.length
        }
      });

      transaction.setAttribute('anomaly_count', anomalies.length.toString());
      transaction.setAttribute('compliance_score', complianceScore.toString());
      transaction.end();

    } catch (error) {
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Anomaly detection failed'),
        {
          businessId,
          severity: 'medium'
        }
      );

      transaction.setAttribute('error', 'true');
      transaction.end();
      throw error;
    }
  }

  private mapCheckTypeToWorkflow(checkType: string): 'tax_filing' | 'rate_update' | 'audit_trail' | 'compliance_check' {
    switch (checkType) {
      case 'filing': return 'tax_filing';
      case 'rate_compliance': return 'rate_update';
      case 'accuracy': return 'audit_trail';
      default: return 'compliance_check';
    }
  }

  private startComplianceMonitoring(): void {
    // Run compliance checks every hour
    setInterval(() => {
      this.runScheduledComplianceChecks();
    }, 60 * 60 * 1000);

    // Run anomaly detection every 6 hours
    setInterval(() => {
      this.runAnomalyDetection();
    }, 6 * 60 * 60 * 1000);

    // Check filing requirements daily
    setInterval(() => {
      this.monitorFilingRequirements();
    }, 24 * 60 * 60 * 1000);

    logger.info('Started compliance monitoring services');
  }

  private async runScheduledComplianceChecks(): Promise<void> {
    try {
      // Get all active businesses
      const businesses = await Business.find({ status: 'active' });
      
      for (const business of businesses) {
        try {
          // Check tax rate compliance
          await this.checkTaxRateCompliance(business._id.toString());
          
          // Check calculation accuracy
          await this.detectTaxCalculationAnomalies(business._id.toString());
          
        } catch (error) {
          logger.error(`Error in compliance check for business ${business._id}:`, error);
        }
      }
    } catch (error) {
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Scheduled compliance check failed'),
        { severity: 'medium' }
      );
    }
  }

  private async runAnomalyDetection(): Promise<void> {
    try {
      const businesses = await Business.find({ status: 'active' });
      
      for (const business of businesses) {
        await this.detectTaxCalculationAnomalies(business._id.toString());
      }
    } catch (error) {
      logger.error('Error running anomaly detection:', error);
    }
  }

  private async checkTaxRateCompliance(businessId: string): Promise<void> {
    try {
      // Get business nexus states
      const business = await Business.findById(businessId);
      if (!business) return;

      const nexusStates = business.nexusStates || [];
      
      for (const state of nexusStates) {
        const stateCode = typeof state === 'string' ? state : (state as any).state;
        
        // Check if we have current tax rates for this state
        const rates = await TaxRate.find({
          state: stateCode,
          active: true,
          effectiveDate: { $lte: new Date() }
        });

        const outdatedRates = rates.filter(rate => {
          const daysSinceUpdate = (Date.now() - rate.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceUpdate > 90; // Rates older than 90 days
        });

        if (outdatedRates.length > 0) {
          await this.performComplianceCheck({
            type: 'rate_compliance',
            businessId,
            jurisdiction: stateCode,
            status: 'warning',
            score: 1 - (outdatedRates.length / rates.length),
            details: `${outdatedRates.length} outdated tax rates found`,
            metadata: {
              total_rates: rates.length,
              outdated_rates: outdatedRates.length,
              oldest_rate_age: Math.max(...outdatedRates.map(r => 
                (Date.now() - r.lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
              ))
            }
          });
        }
      }
    } catch (error) {
      logger.error(`Error checking tax rate compliance for business ${businessId}:`, error);
    }
  }

  public getComplianceReport(businessId?: string): {
    overallScore: number;
    checks: ComplianceCheck[];
    alerts: Array<{ type: string; severity: string; message: string; timestamp: Date }>;
    recentAudits: AuditTrail[];
  } {
    const checks = Array.from(this.complianceCache.values())
      .filter(check => !businessId || check.businessId === businessId);
    
    const overallScore = checks.length > 0 
      ? checks.reduce((sum, check) => sum + check.score, 0) / checks.length 
      : 1.0;

    const alerts = checks
      .filter(check => check.status !== 'pass')
      .map(check => ({
        type: check.type,
        severity: check.score < 0.5 ? 'critical' : check.score < 0.7 ? 'high' : 'medium',
        message: check.details,
        timestamp: check.timestamp
      }));

    const recentAudits = this.auditTrail
      .filter(audit => !businessId || audit.businessId === businessId)
      .slice(-50); // Last 50 audit events

    return {
      overallScore,
      checks,
      alerts,
      recentAudits
    };
  }

  public async generateComplianceReport(businessId: string): Promise<{
    business: {
      id: string;
      name: string;
      complianceScore: number;
    };
    taxAccuracy: {
      score: number;
      anomaliesDetected: number;
      totalCalculations: number;
    };
    filingStatus: {
      upcomingFilings: number;
      overdueFilings: number;
      totalTaxOwed: number;
    };
    systemHealth: {
      posIntegrations: Array<{ type: string; status: string; lastSync: Date | null }>;
      redisPerformance: string;
      overallHealth: string;
    };
  }> {
    const transaction = sentryService.startTransaction(
      'compliance_report_generation',
      'compliance.report',
      { businessId }
    );

    try {
      const business = await Business.findById(businessId);
      if (!business) {
        throw new Error(`Business ${businessId} not found`);
      }

      // Get compliance data
      const complianceData = this.getComplianceReport(businessId);
      
      // Get recent transactions for accuracy analysis
      const recentTransactions = await Transaction.find({
        businessId,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });

      const taxAccuracy = {
        score: complianceData.overallScore,
        anomaliesDetected: complianceData.alerts.filter(a => a.type === 'anomaly').length,
        totalCalculations: recentTransactions.length
      };

      // Get filing requirements
      const businessFilings = Array.from(this.filingRequirements.values())
        .filter(f => f.businessId === businessId);

      const filingStatus = {
        upcomingFilings: businessFilings.filter(f => f.status === 'pending').length,
        overdueFilings: businessFilings.filter(f => f.status === 'overdue').length,
        totalTaxOwed: businessFilings.reduce((sum, f) => sum + f.taxOwed, 0)
      };

      // System health summary
      const systemHealth = {
        posIntegrations: business.integrations?.pos?.map((integration: any) => ({
          type: integration.type,
          status: integration.status || 'unknown',
          lastSync: integration.lastSync || null
        })) || [],
        redisPerformance: 'healthy', // This would be determined from Redis metrics
        overallHealth: complianceData.overallScore > 0.9 ? 'healthy' : 
                      complianceData.overallScore > 0.7 ? 'degraded' : 'unhealthy'
      };

      const report = {
        business: {
          id: businessId,
          name: business.name,
          complianceScore: complianceData.overallScore
        },
        taxAccuracy,
        filingStatus,
        systemHealth
      };

      // Track report generation in Sentry
      sentryService.addBreadcrumb(
        'compliance_report',
        'Generated compliance report',
        'info',
        {
          business_id: businessId,
          compliance_score: complianceData.overallScore,
          anomalies: taxAccuracy.anomaliesDetected,
          upcoming_filings: filingStatus.upcomingFilings
        }
      );

      transaction.end();
      return report;

    } catch (error) {
      transaction.setAttribute('error', 'true');
      transaction.end();
      throw error;
    }
  }

  public getAuditTrail(businessId?: string, limit: number = 100): AuditTrail[] {
    return this.auditTrail
      .filter(audit => !businessId || audit.businessId === businessId)
      .slice(-limit);
  }

  public clearAuditTrail(businessId?: string): void {
    if (businessId) {
      this.auditTrail = this.auditTrail.filter(audit => audit.businessId !== businessId);
    } else {
      this.auditTrail = [];
    }

    sentryService.addBreadcrumb(
      'audit_trail',
      businessId ? `Cleared audit trail for ${businessId}` : 'Cleared all audit trails',
      'info'
    );
  }
}

// Export singleton instance
export const complianceMonitoring = ComplianceMonitoringService.getInstance();
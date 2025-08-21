import { Schema, model, Document } from 'mongoose';
import { logger } from '@/utils';

interface ITaxRateAuditLog extends Document {
  eventType: 'rate_updated' | 'rate_added' | 'rate_removed' | 'compliance_alert' | 'validation_error';
  timestamp: Date;
  state: string;
  jurisdiction: string;
  jurisdictionType: string;
  oldData?: any;
  newData?: any;
  changeDetails: {
    rateDifference?: number;
    effectiveDateChange?: boolean;
    sourceChanged?: boolean;
    categoryChanges?: string[];
  };
  metadata: {
    source: string;
    sourceUrl: string;
    updateMethod: 'manual' | 'scheduled' | 'emergency' | 'firecrawl';
    userId?: string;
    validationResult?: any;
    confidence: 'high' | 'medium' | 'low';
  };
  impact: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedBusinesses?: number;
    estimatedVolumeImpact?: number;
  };
  reviewStatus: 'pending' | 'reviewed' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
}

const taxRateAuditLogSchema = new Schema<ITaxRateAuditLog>({
  eventType: {
    type: String,
    enum: ['rate_updated', 'rate_added', 'rate_removed', 'compliance_alert', 'validation_error'],
    required: true
  },
  timestamp: { type: Date, default: Date.now, required: true },
  state: { type: String, required: true, maxlength: 2 },
  jurisdiction: { type: String, required: true },
  jurisdictionType: {
    type: String,
    enum: ['state', 'county', 'city', 'special'],
    required: true
  },
  oldData: { type: Schema.Types.Mixed },
  newData: { type: Schema.Types.Mixed },
  changeDetails: {
    rateDifference: Number,
    effectiveDateChange: Boolean,
    sourceChanged: Boolean,
    categoryChanges: [String]
  },
  metadata: {
    source: { type: String, required: true },
    sourceUrl: { type: String, required: true },
    updateMethod: {
      type: String,
      enum: ['manual', 'scheduled', 'emergency', 'firecrawl'],
      required: true
    },
    userId: String,
    validationResult: Schema.Types.Mixed,
    confidence: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    }
  },
  impact: {
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true
    },
    affectedBusinesses: Number,
    estimatedVolumeImpact: Number
  },
  reviewStatus: {
    type: String,
    enum: ['pending', 'reviewed', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewedBy: String,
  reviewedAt: Date,
  reviewNotes: String
});

// Indexes for efficient querying
taxRateAuditLogSchema.index({ timestamp: -1 });
taxRateAuditLogSchema.index({ state: 1, jurisdiction: 1 });
taxRateAuditLogSchema.index({ eventType: 1, timestamp: -1 });
taxRateAuditLogSchema.index({ reviewStatus: 1 });
taxRateAuditLogSchema.index({ 'impact.severity': 1, timestamp: -1 });

export const TaxRateAuditLog = model<ITaxRateAuditLog>('TaxRateAuditLog', taxRateAuditLogSchema);

export class TaxRateAuditLogger {
  async logRateUpdate(
    state: string,
    jurisdiction: string,
    jurisdictionType: string,
    oldRate: any,
    newRate: any,
    metadata: any
  ): Promise<void> {
    try {
      const rateDifference = newRate.rate - (oldRate?.rate || 0);
      const changeDetails = this.analyzeChanges(oldRate, newRate);
      const impact = this.assessImpact(rateDifference, state, jurisdiction);
      
      const auditLog = new TaxRateAuditLog({
        eventType: oldRate ? 'rate_updated' : 'rate_added',
        state,
        jurisdiction,
        jurisdictionType,
        oldData: oldRate,
        newData: newRate,
        changeDetails: {
          rateDifference,
          ...changeDetails
        },
        metadata: {
          source: metadata.source || 'Firecrawl',
          sourceUrl: metadata.sourceUrl || '',
          updateMethod: metadata.updateMethod || 'firecrawl',
          userId: metadata.userId,
          validationResult: metadata.validationResult,
          confidence: metadata.confidence || 'medium'
        },
        impact
      });
      
      await auditLog.save();
      
      logger.info(`Audit log created for ${state} ${jurisdiction}: ${rateDifference > 0 ? '+' : ''}${rateDifference.toFixed(4)}%`);
      
      // Log critical changes immediately
      if (impact.severity === 'critical') {
        logger.error(`CRITICAL TAX RATE CHANGE: ${state} ${jurisdiction} changed by ${rateDifference.toFixed(4)}%`, {
          oldRate: oldRate?.rate,
          newRate: newRate.rate,
          effectiveDate: newRate.effectiveDate
        });
      }
      
    } catch (error) {
      logger.error('Failed to create tax rate audit log:', error);
    }
  }

  async logComplianceAlert(alertData: any): Promise<void> {
    try {
      const auditLog = new TaxRateAuditLog({
        eventType: 'compliance_alert',
        state: alertData.affectedStates[0] || 'UNKNOWN',
        jurisdiction: alertData.affectedJurisdictions[0] || 'STATEWIDE',
        jurisdictionType: 'state',
        newData: alertData,
        changeDetails: {},
        metadata: {
          source: alertData.source || 'Compliance Monitor',
          sourceUrl: alertData.sourceUrl || '',
          updateMethod: 'firecrawl',
          confidence: 'medium'
        },
        impact: {
          severity: alertData.severity || 'medium'
        }
      });
      
      await auditLog.save();
      
    } catch (error) {
      logger.error('Failed to log compliance alert:', error);
    }
  }

  async logValidationError(
    state: string,
    jurisdiction: string,
    errorData: any,
    metadata: any
  ): Promise<void> {
    try {
      const auditLog = new TaxRateAuditLog({
        eventType: 'validation_error',
        state,
        jurisdiction,
        jurisdictionType: 'unknown',
        newData: errorData,
        changeDetails: {},
        metadata: {
          source: metadata.source || 'Validation',
          sourceUrl: metadata.sourceUrl || '',
          updateMethod: 'firecrawl',
          validationResult: errorData,
          confidence: 'low'
        },
        impact: {
          severity: 'medium'
        }
      });
      
      await auditLog.save();
      
    } catch (error) {
      logger.error('Failed to log validation error:', error);
    }
  }

  private analyzeChanges(oldRate: any, newRate: any): any {
    const changes: any = {};
    
    if (oldRate) {
      if (oldRate.effectiveDate !== newRate.effectiveDate) {
        changes.effectiveDateChange = true;
      }
      
      if (oldRate.source !== newRate.source) {
        changes.sourceChanged = true;
      }
      
      if (JSON.stringify(oldRate.productCategories) !== JSON.stringify(newRate.productCategories)) {
        changes.categoryChanges = this.identifyCategoryChanges(
          oldRate.productCategories || [],
          newRate.productCategories || []
        );
      }
    }
    
    return changes;
  }

  private identifyCategoryChanges(oldCategories: any[], newCategories: any[]): string[] {
    const changes: string[] = [];
    
    const oldCatMap = new Map(oldCategories.map(c => [c.category, c]));
    const newCatMap = new Map(newCategories.map(c => [c.category, c]));
    
    // Check for removed categories
    for (const [category, _] of oldCatMap) {
      if (!newCatMap.has(category)) {
        changes.push(`Removed category: ${category}`);
      }
    }
    
    // Check for added or modified categories
    for (const [category, newCat] of newCatMap) {
      if (!oldCatMap.has(category)) {
        changes.push(`Added category: ${category}`);
      } else {
        const oldCat = oldCatMap.get(category);
        if (oldCat.rate !== newCat.rate) {
          changes.push(`Rate change for ${category}: ${oldCat.rate}% → ${newCat.rate}%`);
        }
        if (oldCat.exempt !== newCat.exempt) {
          changes.push(`Exemption change for ${category}: ${oldCat.exempt} → ${newCat.exempt}`);
        }
      }
    }
    
    return changes;
  }

  private assessImpact(rateDifference: number, state: string, jurisdiction: string): any {
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    const absChange = Math.abs(rateDifference);
    
    if (absChange >= 1.0) {
      severity = 'critical';
    } else if (absChange >= 0.5) {
      severity = 'high';
    } else if (absChange >= 0.25) {
      severity = 'medium';
    }
    
    return {
      severity,
      affectedBusinesses: this.estimateAffectedBusinesses(state, jurisdiction),
      estimatedVolumeImpact: this.estimateVolumeImpact(rateDifference, state, jurisdiction)
    };
  }

  private estimateAffectedBusinesses(state: string, jurisdiction: string): number {
    // Simplified estimation based on jurisdiction type and size
    // In production, this would query actual business data
    const majorCities = ['Los Angeles', 'New York', 'Chicago', 'Houston', 'Phoenix'];
    
    if (majorCities.some(city => jurisdiction.toLowerCase().includes(city.toLowerCase()))) {
      return 10000; // Major city estimate
    }
    
    return 1000; // Default estimate
  }

  private estimateVolumeImpact(rateDifference: number, state: string, jurisdiction: string): number {
    // Simplified volume impact calculation
    // In production, this would use historical transaction data
    const baseVolume = this.estimateAffectedBusinesses(state, jurisdiction) * 100000; // $100k avg per business
    return baseVolume * Math.abs(rateDifference) / 100;
  }

  async getAuditTrail(
    state?: string,
    jurisdiction?: string,
    startDate?: Date,
    endDate?: Date,
    eventType?: string
  ): Promise<ITaxRateAuditLog[]> {
    const query: any = {};
    
    if (state) query.state = state;
    if (jurisdiction) {
      // Sanitize jurisdiction input to prevent ReDoS attacks
      const sanitizedJurisdiction = jurisdiction.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Use a simple string contains query instead of regex to avoid ReDoS
      query.jurisdiction = { $regex: sanitizedJurisdiction, $options: 'i' };
    }
    if (eventType) query.eventType = eventType;
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }
    
    return await TaxRateAuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(1000);
  }

  async generateAuditReport(
    startDate: Date,
    endDate: Date,
    state?: string
  ): Promise<any> {
    const query: any = {
      timestamp: { $gte: startDate, $lte: endDate }
    };
    
    if (state) query.state = state;
    
    const logs = await TaxRateAuditLog.find(query).sort({ timestamp: -1 });
    
    const report = {
      period: { startDate, endDate },
      state: state || 'ALL',
      summary: {
        totalEvents: logs.length,
        rateUpdates: logs.filter(log => log.eventType === 'rate_updated').length,
        newRates: logs.filter(log => log.eventType === 'rate_added').length,
        complianceAlerts: logs.filter(log => log.eventType === 'compliance_alert').length,
        validationErrors: logs.filter(log => log.eventType === 'validation_error').length,
        criticalEvents: logs.filter(log => log.impact.severity === 'critical').length
      },
      topChanges: this.getTopChanges(logs),
      validationSummary: this.getValidationSummary(logs),
      sourceSummary: this.getSourceSummary(logs),
      pendingReviews: logs.filter(log => log.reviewStatus === 'pending').length
    };
    
    return report;
  }

  private getTopChanges(logs: ITaxRateAuditLog[]): any[] {
    return logs
      .filter(log => log.changeDetails.rateDifference && Math.abs(log.changeDetails.rateDifference) > 0)
      .sort((a, b) => Math.abs(b.changeDetails.rateDifference!) - Math.abs(a.changeDetails.rateDifference!))
      .slice(0, 10)
      .map(log => ({
        state: log.state,
        jurisdiction: log.jurisdiction,
        rateDifference: log.changeDetails.rateDifference,
        timestamp: log.timestamp,
        severity: log.impact.severity
      }));
  }

  private getValidationSummary(logs: ITaxRateAuditLog[]): any {
    const validationLogs = logs.filter(log => log.metadata.validationResult);
    
    return {
      totalValidations: validationLogs.length,
      passed: validationLogs.filter(log => log.metadata.validationResult?.isValid).length,
      failed: validationLogs.filter(log => !log.metadata.validationResult?.isValid).length,
      commonErrors: this.getCommonValidationErrors(validationLogs)
    };
  }

  private getCommonValidationErrors(validationLogs: ITaxRateAuditLog[]): any[] {
    const errorCounts: Map<string, number> = new Map();
    
    for (const log of validationLogs) {
      if (log.metadata.validationResult?.errors) {
        for (const error of log.metadata.validationResult.errors) {
          errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
        }
      }
    }
    
    return Array.from(errorCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));
  }

  private getSourceSummary(logs: ITaxRateAuditLog[]): any {
    const sourceCounts: Map<string, number> = new Map();
    const sourceSuccess: Map<string, number> = new Map();
    
    for (const log of logs) {
      const source = log.metadata.source;
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
      
      if (log.eventType === 'rate_updated' || log.eventType === 'rate_added') {
        sourceSuccess.set(source, (sourceSuccess.get(source) || 0) + 1);
      }
    }
    
    return Array.from(sourceCounts.entries()).map(([source, total]) => ({
      source,
      totalAttempts: total,
      successfulUpdates: sourceSuccess.get(source) || 0,
      successRate: total > 0 ? ((sourceSuccess.get(source) || 0) / total * 100).toFixed(2) + '%' : '0%'
    }));
  }

  async markForReview(
    logId: string,
    severity: 'high' | 'critical',
    reviewNotes?: string
  ): Promise<boolean> {
    try {
      const result = await TaxRateAuditLog.findByIdAndUpdate(
        logId,
        {
          reviewStatus: 'pending',
          reviewNotes: reviewNotes || `Marked for review due to ${severity} severity`,
          'impact.severity': severity
        },
        { new: true }
      );
      
      if (result) {
        logger.info(`Marked audit log ${logId} for review`, {
          state: result.state,
          jurisdiction: result.jurisdiction,
          severity
        });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Failed to mark audit log ${logId} for review:`, error);
      return false;
    }
  }

  async approveAuditLog(
    logId: string,
    reviewedBy: string,
    reviewNotes?: string
  ): Promise<boolean> {
    try {
      const result = await TaxRateAuditLog.findByIdAndUpdate(
        logId,
        {
          reviewStatus: 'approved',
          reviewedBy,
          reviewedAt: new Date(),
          reviewNotes
        },
        { new: true }
      );
      
      if (result) {
        logger.info(`Approved audit log ${logId}`, {
          state: result.state,
          jurisdiction: result.jurisdiction,
          reviewedBy
        });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Failed to approve audit log ${logId}:`, error);
      return false;
    }
  }

  async getPendingReviews(state?: string): Promise<ITaxRateAuditLog[]> {
    const query: any = { reviewStatus: 'pending' };
    if (state) query.state = state;
    
    return await TaxRateAuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(100);
  }

  async getCriticalEvents(days: number = 7): Promise<ITaxRateAuditLog[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    return await TaxRateAuditLog.find({
      timestamp: { $gte: since },
      'impact.severity': 'critical'
    }).sort({ timestamp: -1 });
  }

  async getRecentActivity(state: string, jurisdiction: string, limit: number = 10): Promise<ITaxRateAuditLog[]> {
    // Sanitize jurisdiction input to prevent ReDoS attacks
    const sanitizedJurisdiction = jurisdiction.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    return await TaxRateAuditLog.find({
      state,
      jurisdiction: { $regex: sanitizedJurisdiction, $options: 'i' }
    })
    .sort({ timestamp: -1 })
    .limit(limit);
  }

  async exportAuditData(
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<any> {
    const logs = await TaxRateAuditLog.find({
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: -1 });
    
    if (format === 'csv') {
      return this.convertToCSV(logs);
    }
    
    return logs.map(log => ({
      timestamp: log.timestamp,
      eventType: log.eventType,
      state: log.state,
      jurisdiction: log.jurisdiction,
      jurisdictionType: log.jurisdictionType,
      rateDifference: log.changeDetails.rateDifference,
      severity: log.impact.severity,
      source: log.metadata.source,
      reviewStatus: log.reviewStatus
    }));
  }

  private convertToCSV(logs: ITaxRateAuditLog[]): string {
    const headers = [
      'Timestamp',
      'Event Type',
      'State',
      'Jurisdiction',
      'Jurisdiction Type',
      'Rate Difference',
      'Severity',
      'Source',
      'Review Status'
    ].join(',');
    
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.eventType,
      log.state,
      log.jurisdiction,
      log.jurisdictionType,
      log.changeDetails.rateDifference || '',
      log.impact.severity,
      log.metadata.source,
      log.reviewStatus
    ].join(','));
    
    return [headers, ...rows].join('\n');
  }

  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const result = await TaxRateAuditLog.deleteMany({
      timestamp: { $lt: cutoffDate },
      reviewStatus: { $in: ['approved', 'reviewed'] }
    });
    
    logger.info(`Cleaned up ${result.deletedCount} old audit logs (older than ${retentionDays} days)`);
    
    return result.deletedCount;
  }
}
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxRateAuditLogger = exports.TaxRateAuditLog = void 0;
const mongoose_1 = require("mongoose");
const utils_1 = require("@/utils");
const taxRateAuditLogSchema = new mongoose_1.Schema({
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
    oldData: { type: mongoose_1.Schema.Types.Mixed },
    newData: { type: mongoose_1.Schema.Types.Mixed },
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
        validationResult: mongoose_1.Schema.Types.Mixed,
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
taxRateAuditLogSchema.index({ timestamp: -1 });
taxRateAuditLogSchema.index({ state: 1, jurisdiction: 1 });
taxRateAuditLogSchema.index({ eventType: 1, timestamp: -1 });
taxRateAuditLogSchema.index({ reviewStatus: 1 });
taxRateAuditLogSchema.index({ 'impact.severity': 1, timestamp: -1 });
exports.TaxRateAuditLog = (0, mongoose_1.model)('TaxRateAuditLog', taxRateAuditLogSchema);
class TaxRateAuditLogger {
    async logRateUpdate(state, jurisdiction, jurisdictionType, oldRate, newRate, metadata) {
        try {
            const rateDifference = newRate.rate - (oldRate?.rate || 0);
            const changeDetails = this.analyzeChanges(oldRate, newRate);
            const impact = this.assessImpact(rateDifference, state, jurisdiction);
            const auditLog = new exports.TaxRateAuditLog({
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
            utils_1.logger.info(`Audit log created for ${state} ${jurisdiction}: ${rateDifference > 0 ? '+' : ''}${rateDifference.toFixed(4)}%`);
            if (impact.severity === 'critical') {
                utils_1.logger.error(`CRITICAL TAX RATE CHANGE: ${state} ${jurisdiction} changed by ${rateDifference.toFixed(4)}%`, {
                    oldRate: oldRate?.rate,
                    newRate: newRate.rate,
                    effectiveDate: newRate.effectiveDate
                });
            }
        }
        catch (error) {
            utils_1.logger.error('Failed to create tax rate audit log:', error);
        }
    }
    async logComplianceAlert(alertData) {
        try {
            const auditLog = new exports.TaxRateAuditLog({
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
        }
        catch (error) {
            utils_1.logger.error('Failed to log compliance alert:', error);
        }
    }
    async logValidationError(state, jurisdiction, errorData, metadata) {
        try {
            const auditLog = new exports.TaxRateAuditLog({
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
        }
        catch (error) {
            utils_1.logger.error('Failed to log validation error:', error);
        }
    }
    analyzeChanges(oldRate, newRate) {
        const changes = {};
        if (oldRate) {
            if (oldRate.effectiveDate !== newRate.effectiveDate) {
                changes.effectiveDateChange = true;
            }
            if (oldRate.source !== newRate.source) {
                changes.sourceChanged = true;
            }
            if (JSON.stringify(oldRate.productCategories) !== JSON.stringify(newRate.productCategories)) {
                changes.categoryChanges = this.identifyCategoryChanges(oldRate.productCategories || [], newRate.productCategories || []);
            }
        }
        return changes;
    }
    identifyCategoryChanges(oldCategories, newCategories) {
        const changes = [];
        const oldCatMap = new Map(oldCategories.map(c => [c.category, c]));
        const newCatMap = new Map(newCategories.map(c => [c.category, c]));
        for (const [category, _] of oldCatMap) {
            if (!newCatMap.has(category)) {
                changes.push(`Removed category: ${category}`);
            }
        }
        for (const [category, newCat] of newCatMap) {
            if (!oldCatMap.has(category)) {
                changes.push(`Added category: ${category}`);
            }
            else {
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
    assessImpact(rateDifference, state, jurisdiction) {
        let severity = 'low';
        const absChange = Math.abs(rateDifference);
        if (absChange >= 1.0) {
            severity = 'critical';
        }
        else if (absChange >= 0.5) {
            severity = 'high';
        }
        else if (absChange >= 0.25) {
            severity = 'medium';
        }
        return {
            severity,
            affectedBusinesses: this.estimateAffectedBusinesses(state, jurisdiction),
            estimatedVolumeImpact: this.estimateVolumeImpact(rateDifference, state, jurisdiction)
        };
    }
    estimateAffectedBusinesses(state, jurisdiction) {
        const majorCities = ['Los Angeles', 'New York', 'Chicago', 'Houston', 'Phoenix'];
        if (majorCities.some(city => jurisdiction.toLowerCase().includes(city.toLowerCase()))) {
            return 10000;
        }
        return 1000;
    }
    estimateVolumeImpact(rateDifference, state, jurisdiction) {
        const baseVolume = this.estimateAffectedBusinesses(state, jurisdiction) * 100000;
        return baseVolume * Math.abs(rateDifference) / 100;
    }
    async getAuditTrail(state, jurisdiction, startDate, endDate, eventType) {
        const query = {};
        if (state)
            query.state = state;
        if (jurisdiction) {
            const sanitizedJurisdiction = jurisdiction.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.jurisdiction = { $regex: sanitizedJurisdiction, $options: 'i' };
        }
        if (eventType)
            query.eventType = eventType;
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate)
                query.timestamp.$gte = startDate;
            if (endDate)
                query.timestamp.$lte = endDate;
        }
        return await exports.TaxRateAuditLog.find(query)
            .sort({ timestamp: -1 })
            .limit(1000);
    }
    async generateAuditReport(startDate, endDate, state) {
        const query = {
            timestamp: { $gte: startDate, $lte: endDate }
        };
        if (state)
            query.state = state;
        const logs = await exports.TaxRateAuditLog.find(query).sort({ timestamp: -1 });
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
    getTopChanges(logs) {
        return logs
            .filter(log => log.changeDetails.rateDifference && Math.abs(log.changeDetails.rateDifference) > 0)
            .sort((a, b) => Math.abs(b.changeDetails.rateDifference) - Math.abs(a.changeDetails.rateDifference))
            .slice(0, 10)
            .map(log => ({
            state: log.state,
            jurisdiction: log.jurisdiction,
            rateDifference: log.changeDetails.rateDifference,
            timestamp: log.timestamp,
            severity: log.impact.severity
        }));
    }
    getValidationSummary(logs) {
        const validationLogs = logs.filter(log => log.metadata.validationResult);
        return {
            totalValidations: validationLogs.length,
            passed: validationLogs.filter(log => log.metadata.validationResult?.isValid).length,
            failed: validationLogs.filter(log => !log.metadata.validationResult?.isValid).length,
            commonErrors: this.getCommonValidationErrors(validationLogs)
        };
    }
    getCommonValidationErrors(validationLogs) {
        const errorCounts = new Map();
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
    getSourceSummary(logs) {
        const sourceCounts = new Map();
        const sourceSuccess = new Map();
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
    async markForReview(logId, severity, reviewNotes) {
        try {
            const result = await exports.TaxRateAuditLog.findByIdAndUpdate(logId, {
                reviewStatus: 'pending',
                reviewNotes: reviewNotes || `Marked for review due to ${severity} severity`,
                'impact.severity': severity
            }, { new: true });
            if (result) {
                utils_1.logger.info(`Marked audit log ${logId} for review`, {
                    state: result.state,
                    jurisdiction: result.jurisdiction,
                    severity
                });
                return true;
            }
            return false;
        }
        catch (error) {
            utils_1.logger.error(`Failed to mark audit log ${logId} for review:`, error);
            return false;
        }
    }
    async approveAuditLog(logId, reviewedBy, reviewNotes) {
        try {
            const result = await exports.TaxRateAuditLog.findByIdAndUpdate(logId, {
                reviewStatus: 'approved',
                reviewedBy,
                reviewedAt: new Date(),
                reviewNotes
            }, { new: true });
            if (result) {
                utils_1.logger.info(`Approved audit log ${logId}`, {
                    state: result.state,
                    jurisdiction: result.jurisdiction,
                    reviewedBy
                });
                return true;
            }
            return false;
        }
        catch (error) {
            utils_1.logger.error(`Failed to approve audit log ${logId}:`, error);
            return false;
        }
    }
    async getPendingReviews(state) {
        const query = { reviewStatus: 'pending' };
        if (state)
            query.state = state;
        return await exports.TaxRateAuditLog.find(query)
            .sort({ timestamp: -1 })
            .limit(100);
    }
    async getCriticalEvents(days = 7) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        return await exports.TaxRateAuditLog.find({
            timestamp: { $gte: since },
            'impact.severity': 'critical'
        }).sort({ timestamp: -1 });
    }
    async getRecentActivity(state, jurisdiction, limit = 10) {
        const sanitizedJurisdiction = jurisdiction.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return await exports.TaxRateAuditLog.find({
            state,
            jurisdiction: { $regex: sanitizedJurisdiction, $options: 'i' }
        })
            .sort({ timestamp: -1 })
            .limit(limit);
    }
    async exportAuditData(startDate, endDate, format = 'json') {
        const logs = await exports.TaxRateAuditLog.find({
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
    convertToCSV(logs) {
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
    async cleanupOldLogs(retentionDays = 365) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        const result = await exports.TaxRateAuditLog.deleteMany({
            timestamp: { $lt: cutoffDate },
            reviewStatus: { $in: ['approved', 'reviewed'] }
        });
        utils_1.logger.info(`Cleaned up ${result.deletedCount} old audit logs (older than ${retentionDays} days)`);
        return result.deletedCount;
    }
}
exports.TaxRateAuditLogger = TaxRateAuditLogger;
//# sourceMappingURL=TaxRateAuditLogger.js.map
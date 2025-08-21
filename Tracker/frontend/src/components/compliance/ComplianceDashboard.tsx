import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Grid, 
  Typography, 
  Button, 
  Chip, 
  List, 
  ListItem, 
  ListItemText, 
  Alert,
  Box,
  CircularProgress,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
  Notifications as NotificationsIcon,
  FileUpload as FileUploadIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

import { filingService, Filing, FilingPeriod, DeadlineAlert, ComplianceIssue } from '../../services/compliance/FilingService';
import { notificationService } from '../../services/compliance/NotificationService';

interface ComplianceDashboardProps {
  businessId: string;
}

interface DashboardStats {
  totalFilings: number;
  pendingFilings: number;
  overdueFilings: number;
  upcomingDeadlines: number;
  complianceScore: number;
  lastUpdated: Date;
}

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ businessId }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [filings, setFilings] = useState<Filing[]>([]);
  const [deadlineAlerts, setDeadlineAlerts] = useState<DeadlineAlert[]>([]);
  const [complianceIssues, setComplianceIssues] = useState<ComplianceIssue[]>([]);
  const [upcomingPeriods, setUpcomingPeriods] = useState<FilingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiling, setSelectedFiling] = useState<Filing | null>(null);
  const [filingDetailOpen, setFilingDetailOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [businessId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load all dashboard data
      const [
        alertsData,
        issuesData,
        upcomingData
      ] = await Promise.all([
        notificationService.getDeadlineAlerts(businessId),
        notificationService.getComplianceIssues(businessId, { resolved: false }),
        filingService.getUpcomingFilings(businessId, 60) // Next 60 days
      ]);

      setDeadlineAlerts(alertsData);
      setComplianceIssues(issuesData);
      setUpcomingPeriods(upcomingData);

      // Calculate dashboard stats
      const overdueCount = alertsData.filter(alert => alert.isOverdue).length;
      const upcomingCount = alertsData.filter(alert => !alert.isOverdue && alert.daysUntilDue <= 30).length;
      const totalIssues = issuesData.length;
      
      // Calculate compliance score (simplified algorithm)
      let complianceScore = 100;
      complianceScore -= overdueCount * 15; // -15 points per overdue filing
      complianceScore -= upcomingCount * 5; // -5 points per upcoming deadline
      complianceScore -= totalIssues * 10; // -10 points per unresolved issue
      complianceScore = Math.max(0, Math.min(100, complianceScore));

      setStats({
        totalFilings: alertsData.length,
        pendingFilings: alertsData.filter(alert => alert.filingId).length,
        overdueFilings: overdueCount,
        upcomingDeadlines: upcomingCount,
        complianceScore,
        lastUpdated: new Date()
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleGenerateFiling = async (period: FilingPeriod) => {
    try {
      const filing = await filingService.generateFiling(businessId, period.jurisdiction, period);
      console.log('Generated filing:', filing);
      
      // Refresh data
      await loadDashboardData();
    } catch (error) {
      console.error('Error generating filing:', error);
    }
  };

  const handleViewFiling = (filing: Filing) => {
    setSelectedFiling(filing);
    setFilingDetailOpen(true);
  };

  const handleSubmitFiling = async (filingId: string) => {
    try {
      await filingService.submitFiling(filingId);
      await loadDashboardData();
    } catch (error) {
      console.error('Error submitting filing:', error);
    }
  };

  const getStatusColor = (status: Filing['status']) => {
    switch (status) {
      case 'submitted':
      case 'accepted':
        return 'success';
      case 'rejected':
      case 'amendment_required':
        return 'error';
      case 'ready_for_review':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'high':
        return <WarningIcon color="warning" />;
      case 'medium':
        return <ScheduleIcon color="info" />;
      default:
        return <CheckCircleIcon color="success" />;
    }
  };

  const getAlertLevelColor = (level: DeadlineAlert['alertLevel']) => {
    switch (level) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Compliance Dashboard
        </Typography>
        <Button
          variant="outlined"
          startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          Refresh
        </Button>
      </Box>

      {/* Dashboard Stats */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <Box p={2}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Compliance Score
              </Typography>
              <Box position="relative" display="inline-flex">
                <CircularProgress
                  variant="determinate"
                  value={stats?.complianceScore || 0}
                  size={80}
                  color={stats?.complianceScore && stats.complianceScore > 80 ? 'success' : 
                         stats?.complianceScore && stats.complianceScore > 60 ? 'warning' : 'error'}
                />
                <Box
                  position="absolute"
                  top={0}
                  left={0}
                  bottom={0}
                  right={0}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Typography variant="h6" color="textSecondary">
                    {stats?.complianceScore || 0}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <Box p={2}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Overdue Filings
              </Typography>
              <Typography variant="h3" color="error">
                {stats?.overdueFilings || 0}
              </Typography>
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <Box p={2}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Upcoming Deadlines
              </Typography>
              <Typography variant="h3" color="warning.main">
                {stats?.upcomingDeadlines || 0}
              </Typography>
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <Box p={2}>
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Open Issues
              </Typography>
              <Typography variant="h3" color="info.main">
                {complianceIssues.length}
              </Typography>
            </Box>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Deadline Alerts */}
        <Grid item xs={12} lg={6}>
          <Card>
            <Box p={2}>
              <Box display="flex" alignItems="center" mb={2}>
                <WarningIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Filing Deadlines
                </Typography>
                <Badge badgeContent={deadlineAlerts.length} color="warning" sx={{ ml: 1 }}>
                  <NotificationsIcon />
                </Badge>
              </Box>

              {deadlineAlerts.length === 0 ? (
                <Typography color="textSecondary">
                  No upcoming deadlines
                </Typography>
              ) : (
                <List>
                  {deadlineAlerts.slice(0, 5).map((alert) => (
                    <ListItem key={alert.id} divider>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle2">
                              {alert.filingType} - {alert.jurisdiction}
                            </Typography>
                            <Chip
                              size="small"
                              label={alert.isOverdue ? 'OVERDUE' : `${alert.daysUntilDue} days`}
                              color={getAlertLevelColor(alert.alertLevel)}
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={`Due: ${alert.dueDate.toLocaleDateString()}`}
                      />
                      <Box>
                        {alert.estimatedAmount && (
                          <Typography variant="body2" color="textSecondary">
                            Est. ${alert.estimatedAmount.toLocaleString()}
                          </Typography>
                        )}
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Compliance Issues */}
        <Grid item xs={12} lg={6}>
          <Card>
            <Box p={2}>
              <Box display="flex" alignItems="center" mb={2}>
                <ErrorIcon color="error" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Compliance Issues
                </Typography>
              </Box>

              {complianceIssues.length === 0 ? (
                <Alert severity="success">
                  No compliance issues detected
                </Alert>
              ) : (
                <List>
                  {complianceIssues.slice(0, 5).map((issue) => (
                    <ListItem key={issue.id} divider>
                      <Box sx={{ mr: 1 }}>
                        {getSeverityIcon(issue.severity)}
                      </Box>
                      <ListItemText
                        primary={issue.title}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              {issue.description}
                            </Typography>
                            <Chip
                              size="small"
                              label={issue.severity.toUpperCase()}
                              color={issue.severity === 'critical' ? 'error' : 
                                     issue.severity === 'high' ? 'warning' : 'info'}
                              variant="outlined"
                              sx={{ mt: 1 }}
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Upcoming Filing Periods */}
        <Grid item xs={12}>
          <Card>
            <Box p={2}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center">
                  <AssessmentIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">
                    Upcoming Filing Periods
                  </Typography>
                </Box>
              </Box>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Jurisdiction</TableCell>
                      <TableCell>Frequency</TableCell>
                      <TableCell>Period</TableCell>
                      <TableCell>Due Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {upcomingPeriods.slice(0, 10).map((period) => {
                      const alert = deadlineAlerts.find(a => 
                        a.jurisdiction === period.jurisdiction && 
                        a.dueDate.getTime() === period.dueDate.getTime()
                      );

                      return (
                        <TableRow key={period.id}>
                          <TableCell>{period.jurisdiction}</TableCell>
                          <TableCell>
                            <Chip 
                              size="small" 
                              label={period.frequency} 
                              variant="outlined" 
                            />
                          </TableCell>
                          <TableCell>
                            {period.periodStart.toLocaleDateString()} - {period.periodEnd.toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              {period.dueDate.toLocaleDateString()}
                              {period.isOverdue && (
                                <Chip size="small" label="OVERDUE" color="error" />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={alert?.filingId ? 'Generated' : 'Pending'}
                              color={alert?.filingId ? 'primary' : 'default'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Box display="flex" gap={1}>
                              {!alert?.filingId ? (
                                <Tooltip title="Generate Filing">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleGenerateFiling(period)}
                                    color="primary"
                                  >
                                    <FileUploadIcon />
                                  </IconButton>
                                </Tooltip>
                              ) : (
                                <Tooltip title="View Filing">
                                  <IconButton
                                    size="small"
                                    onClick={() => {/* Handle view filing */}}
                                    color="primary"
                                  >
                                    <VisibilityIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Filing Detail Dialog */}
      <Dialog
        open={filingDetailOpen}
        onClose={() => setFilingDetailOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Filing Details
          {selectedFiling && (
            <Chip
              size="small"
              label={selectedFiling.status.replace('_', ' ').toUpperCase()}
              color={getStatusColor(selectedFiling.status)}
              sx={{ ml: 2 }}
            />
          )}
        </DialogTitle>
        <DialogContent>
          {selectedFiling && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Jurisdiction
                  </Typography>
                  <Typography>{selectedFiling.jurisdiction}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Due Date
                  </Typography>
                  <Typography>{selectedFiling.dueDate.toLocaleDateString()}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Gross Sales
                  </Typography>
                  <Typography>${selectedFiling.filingData.grossSales.toLocaleString()}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Tax Collected
                  </Typography>
                  <Typography>${selectedFiling.filingData.taxCollected.toLocaleString()}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Accuracy Score
                  </Typography>
                  <Box display="flex" alignItems="center" gap={2}>
                    <LinearProgress
                      variant="determinate"
                      value={selectedFiling.estimatedAccuracy * 100}
                      sx={{ flexGrow: 1, height: 8 }}
                      color={selectedFiling.estimatedAccuracy > 0.8 ? 'success' : 'warning'}
                    />
                    <Typography variant="body2">
                      {Math.round(selectedFiling.estimatedAccuracy * 100)}%
                    </Typography>
                  </Box>
                </Grid>
                {selectedFiling.validationErrors.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Validation Issues
                    </Typography>
                    {selectedFiling.validationErrors.map((error, index) => (
                      <Alert key={index} severity={error.severity as any} sx={{ mt: 1 }}>
                        <strong>{error.field}:</strong> {error.message}
                      </Alert>
                    ))}
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilingDetailOpen(false)}>
            Close
          </Button>
          {selectedFiling?.status === 'ready_for_review' && (
            <Button
              variant="contained"
              onClick={() => {
                if (selectedFiling) {
                  handleSubmitFiling(selectedFiling.id);
                  setFilingDetailOpen(false);
                }
              }}
            >
              Submit Filing
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

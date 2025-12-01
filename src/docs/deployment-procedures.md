# Deployment and Rollback Procedures

This document outlines the deployment sequence for the database query performance fixes and provides rollback procedures in case of issues.

## Pre-Deployment Checklist

### 1. Code Review and Testing
- [ ] All unit tests pass (`npm test`)
- [ ] Integration tests pass
- [ ] Performance regression tests validate improvements
- [ ] Schema validation tests confirm no remaining column mismatches
- [ ] Circuit breaker tests verify proper error handling

### 2. Database Validation
- [ ] Verify current database schema matches expected structure
- [ ] Confirm `appointment_series.notes` column does not exist
- [ ] Validate all queries in codebase match current schema
- [ ] Run schema validation script: `node scripts/validate-schema.js`

### 3. Monitoring Setup
- [ ] Circuit breaker monitoring is enabled
- [ ] Query performance logging is active
- [ ] Error tracking is configured
- [ ] Alerting thresholds are set

## Deployment Sequence

### Phase 1: Critical Schema Fixes (Emergency Priority)

**Objective**: Fix immediate schema mismatch causing 60+ second load times

**Steps**:
1. Deploy schema fix changes to `useUnifiedAppointments` hook
2. Remove references to non-existent `notes` column
3. Update any other identified schema mismatches

**Validation**:
```bash
# Test that Services page loads quickly
curl -w "@curl-format.txt" -o /dev/null -s "https://your-app.com/services"

# Expected: Total time < 5 seconds
```

**Rollback Trigger**: If page load times don't improve within 5 minutes

### Phase 2: Circuit Breaker Optimization

**Objective**: Improve error handling and recovery times

**Steps**:
1. Deploy updated circuit breaker configuration
2. Update error classification logic
3. Enable enhanced monitoring and alerting

**Validation**:
```bash
# Monitor circuit breaker state
curl "https://your-app.com/api/health/circuit-breaker"

# Expected: Circuit breaker should be CLOSED with low failure count
```

**Rollback Trigger**: If circuit breaker opens frequently (>3 times in 10 minutes)

### Phase 3: Conditional Loading Implementation

**Objective**: Optimize data loading patterns

**Steps**:
1. Deploy conditional loading changes to `useUnifiedAppointments`
2. Update Dashboard components with route-based loading
3. Implement lazy loading for non-critical components

**Validation**:
```bash
# Test that non-dashboard pages don't load appointment data
# Check network tab - should see no appointment queries on /services page
```

**Rollback Trigger**: If any page shows loading errors or missing data

### Phase 4: Enhanced Error Handling

**Objective**: Improve user experience during failures

**Steps**:
1. Deploy graceful degradation components
2. Enable detailed query logging
3. Activate performance monitoring dashboard

**Validation**:
- Verify error states show user-friendly messages
- Confirm cached data displays during circuit breaker open state
- Check that performance metrics are being collected

## Deployment Commands

### Development Environment
```bash
# Run all tests
npm test

# Build application
npm run build

# Start development server
npm run dev
```

### Staging Environment
```bash
# Deploy to staging
git checkout main
git pull origin main
npm ci
npm run build
npm run test:integration

# Deploy to staging server
# (Replace with your deployment process)
```

### Production Environment
```bash
# Create deployment branch
git checkout -b deploy/performance-fixes-$(date +%Y%m%d-%H%M)
git push origin deploy/performance-fixes-$(date +%Y%m%d-%H%M)

# Deploy with zero-downtime strategy
# (Replace with your production deployment process)

# Verify deployment
curl -f https://your-app.com/health
```

## Rollback Procedures

### Automatic Rollback Triggers

The following conditions should trigger an automatic rollback:

1. **Page Load Time Regression**
   - Any page takes >15 seconds to load
   - Services page takes >10 seconds to load

2. **Error Rate Increase**
   - Error rate increases by >50% compared to baseline
   - Circuit breaker opens >5 times in 10 minutes

3. **Critical Functionality Broken**
   - Users cannot view appointments
   - Dashboard shows no data when it should
   - Authentication failures increase

### Manual Rollback Process

#### Phase 1: Immediate Rollback (< 5 minutes)

**For Critical Issues**:
```bash
# Revert to previous deployment
git revert HEAD~1  # Or specific commit hash
npm run build
# Deploy reverted version

# Alternative: Feature flag disable
# Set ENABLE_PERFORMANCE_FIXES=false in environment
```

#### Phase 2: Selective Rollback (5-15 minutes)

**For Specific Component Issues**:
```bash
# Revert specific changes
git revert <commit-hash-of-problematic-change>

# Or disable specific features
# Update feature flags:
# - ENABLE_CONDITIONAL_LOADING=false
# - ENABLE_CIRCUIT_BREAKER_V2=false
```

#### Phase 3: Full Rollback (15-30 minutes)

**For Widespread Issues**:
```bash
# Complete rollback to previous stable version
git checkout <previous-stable-tag>
npm ci
npm run build
# Full redeployment
```

### Rollback Validation

After rollback, verify:
- [ ] Page load times return to acceptable levels (<10 seconds)
- [ ] No increase in error rates
- [ ] All critical functionality works
- [ ] Users can access appointments and dashboard data

## Monitoring Checklist

### During Deployment (First 30 minutes)

Monitor these metrics every 5 minutes:

1. **Page Load Times**
   - Dashboard: < 5 seconds
   - Services: < 5 seconds
   - Other pages: < 10 seconds

2. **Error Rates**
   - Database query errors: < 1%
   - Circuit breaker opens: 0
   - JavaScript errors: < baseline + 10%

3. **User Experience**
   - Successful page loads: > 95%
   - Data loading success: > 98%
   - User complaints: 0

### Post-Deployment (First 24 hours)

Monitor these metrics hourly:

1. **Performance Metrics**
   ```bash
   # Query performance
   SELECT AVG(duration_ms) FROM query_logs 
   WHERE timestamp > NOW() - INTERVAL '1 hour';
   
   # Circuit breaker state
   SELECT state, failure_count FROM circuit_breaker_logs 
   ORDER BY timestamp DESC LIMIT 10;
   ```

2. **Error Tracking**
   ```bash
   # Error rates by type
   SELECT error_type, COUNT(*) FROM error_logs 
   WHERE timestamp > NOW() - INTERVAL '1 hour'
   GROUP BY error_type;
   ```

3. **User Impact**
   - Session duration changes
   - Page bounce rate changes
   - Feature usage patterns

## Emergency Contacts

### Deployment Team
- **Primary**: [Your Name] - [phone] - [email]
- **Secondary**: [Backup Name] - [phone] - [email]

### Database Team
- **DBA**: [DBA Name] - [phone] - [email]

### Infrastructure Team
- **DevOps**: [DevOps Name] - [phone] - [email]

## Communication Plan

### Internal Communication

**Before Deployment**:
- Notify team in #deployments channel
- Update status page if user-facing changes expected

**During Deployment**:
- Post updates every 15 minutes in #deployments
- Escalate immediately if rollback triggers are hit

**After Deployment**:
- Post completion status with key metrics
- Schedule post-mortem if any issues occurred

### External Communication

**If User Impact Expected**:
- Update status page before deployment
- Prepare customer communication templates
- Have support team ready for increased tickets

**If Rollback Required**:
- Immediate status page update
- Customer notification within 30 minutes
- Follow-up communication with resolution timeline

## Success Criteria

### Immediate Success (First Hour)
- [ ] All pages load in <10 seconds
- [ ] No increase in error rates
- [ ] Circuit breaker remains CLOSED
- [ ] No user complaints

### Short-term Success (First Week)
- [ ] Average page load time improved by >50%
- [ ] Database query error rate <0.5%
- [ ] Circuit breaker opens <1 time per day
- [ ] User satisfaction metrics stable or improved

### Long-term Success (First Month)
- [ ] Sustained performance improvements
- [ ] No performance regressions
- [ ] Reduced infrastructure costs from optimized queries
- [ ] Improved developer productivity from better error handling

## Post-Deployment Tasks

### Immediate (Within 24 hours)
- [ ] Verify all monitoring is working correctly
- [ ] Review error logs for any new issues
- [ ] Update documentation with any deployment learnings
- [ ] Schedule team retrospective

### Short-term (Within 1 week)
- [ ] Analyze performance improvement metrics
- [ ] Gather user feedback
- [ ] Identify any additional optimization opportunities
- [ ] Update alerting thresholds based on new baselines

### Long-term (Within 1 month)
- [ ] Conduct full performance review
- [ ] Document lessons learned
- [ ] Plan next optimization phase
- [ ] Update deployment procedures based on experience

## Troubleshooting Common Issues

### Issue: Page Still Loading Slowly
**Symptoms**: Load times >10 seconds after deployment
**Investigation**:
1. Check if schema fixes were applied correctly
2. Verify circuit breaker is not open
3. Check for new database errors in logs
4. Validate conditional loading is working

**Resolution**:
1. If schema errors persist: Immediate rollback
2. If circuit breaker open: Check underlying database issues
3. If conditional loading broken: Disable feature flag

### Issue: Data Not Loading
**Symptoms**: Empty states or missing data
**Investigation**:
1. Check if conditional loading is too restrictive
2. Verify authentication is working
3. Check for permission errors
4. Validate query filters

**Resolution**:
1. Adjust conditional loading conditions
2. Fix authentication issues
3. Update permission settings
4. Correct query filters

### Issue: Increased Error Rates
**Symptoms**: More errors than baseline
**Investigation**:
1. Check error types and patterns
2. Verify circuit breaker configuration
3. Look for new error sources
4. Check if errors are properly classified

**Resolution**:
1. Fix underlying error causes
2. Adjust circuit breaker settings if needed
3. Update error classification logic
4. Implement additional error handling

This deployment procedure ensures a safe, monitored rollout of the performance fixes with clear rollback procedures and success criteria.
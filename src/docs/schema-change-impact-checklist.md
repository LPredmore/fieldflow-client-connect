# Schema Change Impact Analysis Checklist

This checklist ensures comprehensive impact analysis before making any database schema changes to prevent query failures and performance issues.

## Pre-Change Analysis

### 1. Schema Change Details
- [ ] **Change Type**
  - [ ] Adding column(s)
  - [ ] Removing column(s)
  - [ ] Renaming column(s)
  - [ ] Changing column type(s)
  - [ ] Adding table(s)
  - [ ] Removing table(s)
  - [ ] Adding constraint(s)
  - [ ] Removing constraint(s)
  - [ ] Adding index(es)
  - [ ] Removing index(es)

- [ ] **Affected Objects**
  - Tables: ________________
  - Columns: _______________
  - Constraints: ___________
  - Indexes: ______________

### 2. Risk Assessment
- [ ] **Risk Level**
  - [ ] Low Risk (additive changes)
  - [ ] Medium Risk (modifications with compatibility)
  - [ ] High Risk (removals or breaking changes)

- [ ] **Impact Scope**
  - [ ] Single table
  - [ ] Multiple related tables
  - [ ] Cross-schema dependencies
  - [ ] External system integrations

### 3. Dependency Analysis
- [ ] **Database Dependencies**
  - [ ] Foreign key relationships mapped
  - [ ] View dependencies identified
  - [ ] Stored procedure dependencies checked
  - [ ] Trigger dependencies verified
  - [ ] Index dependencies documented

- [ ] **Application Dependencies**
  - [ ] Direct query references found
  - [ ] ORM model dependencies identified
  - [ ] API endpoint dependencies mapped
  - [ ] Component dependencies traced

## Code Impact Analysis

### 4. Automated Code Search
Run these searches and document results:

```bash
# Search for direct column references
grep -r "column_name" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"
```
- [ ] **Results documented**: _____ files found
- [ ] **All references reviewed**: Yes/No

```bash
# Search for table references  
grep -r "table_name" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"
```
- [ ] **Results documented**: _____ files found
- [ ] **All references reviewed**: Yes/No

```bash
# Search in SQL files and migrations
find . -name "*.sql" -exec grep -l "column_name\|table_name" {} \;
```
- [ ] **Results documented**: _____ files found
- [ ] **Migration files updated**: Yes/No/N/A

### 5. Query Analysis
- [ ] **Direct SQL Queries**
  - [ ] Raw SQL queries identified
  - [ ] Query builder usage mapped
  - [ ] ORM queries documented
  - [ ] Dynamic query construction checked

- [ ] **Supabase/PostgREST Queries**
  - [ ] `.select()` statements reviewed
  - [ ] `.insert()` statements checked
  - [ ] `.update()` statements verified
  - [ ] `.upsert()` statements examined
  - [ ] Join queries analyzed

### 6. Component Impact Assessment
For each affected component:

**Component**: _________________
- [ ] **Direct usage**: Yes/No
- [ ] **Indirect usage**: Yes/No  
- [ ] **Critical path**: Yes/No
- [ ] **User-facing**: Yes/No
- [ ] **Update required**: Yes/No
- [ ] **Testing required**: Yes/No

**Component**: _________________
- [ ] **Direct usage**: Yes/No
- [ ] **Indirect usage**: Yes/No
- [ ] **Critical path**: Yes/No
- [ ] **User-facing**: Yes/No
- [ ] **Update required**: Yes/No
- [ ] **Testing required**: Yes/No

## Data Impact Analysis

### 7. Data Migration Requirements
- [ ] **Data Preservation**
  - [ ] No data migration needed
  - [ ] Simple data copy required
  - [ ] Data transformation needed
  - [ ] Data cleanup required
  - [ ] Backup strategy defined

- [ ] **Migration Complexity**
  - [ ] Single-step migration
  - [ ] Multi-step migration required
  - [ ] Rollback data strategy defined
  - [ ] Data validation plan created

### 8. Performance Impact
- [ ] **Query Performance**
  - [ ] Index impact analyzed
  - [ ] Query plan changes reviewed
  - [ ] Performance benchmarks defined
  - [ ] Load testing plan created

- [ ] **Storage Impact**
  - [ ] Disk space requirements calculated
  - [ ] Memory usage impact estimated
  - [ ] Backup size impact assessed

## Testing Strategy

### 9. Test Coverage Plan
- [ ] **Unit Tests**
  - [ ] Model tests updated
  - [ ] Query tests modified
  - [ ] Validation tests added
  - [ ] Error handling tests included

- [ ] **Integration Tests**
  - [ ] API endpoint tests updated
  - [ ] Component integration tests modified
  - [ ] Database integration tests added
  - [ ] End-to-end tests updated

- [ ] **Schema Validation Tests**
  - [ ] Column existence tests added
  - [ ] Query success tests created
  - [ ] Error condition tests included
  - [ ] Performance regression tests defined

### 10. Environment Testing
- [ ] **Development Environment**
  - [ ] Schema changes applied
  - [ ] Code changes tested
  - [ ] All tests passing
  - [ ] Manual testing completed

- [ ] **Staging Environment**
  - [ ] Schema changes applied
  - [ ] Full application tested
  - [ ] Performance validated
  - [ ] User acceptance testing completed

## Deployment Planning

### 11. Migration Strategy
- [ ] **Deployment Approach**
  - [ ] Code-first deployment (for removals)
  - [ ] Schema-first deployment (for additions)
  - [ ] Parallel deployment (for modifications)
  - [ ] Blue-green deployment (for major changes)

- [ ] **Rollout Plan**
  - [ ] Single-step deployment
  - [ ] Phased rollout
  - [ ] Feature flag controlled
  - [ ] Canary deployment

### 12. Rollback Planning
- [ ] **Rollback Triggers**
  - [ ] Error rate thresholds defined
  - [ ] Performance degradation limits set
  - [ ] User impact criteria established
  - [ ] Monitoring alerts configured

- [ ] **Rollback Procedures**
  - [ ] Code rollback steps documented
  - [ ] Schema rollback scripts prepared
  - [ ] Data recovery procedures defined
  - [ ] Communication plan established

## Risk Mitigation

### 13. Circuit Breaker Considerations
- [ ] **Error Handling**
  - [ ] Schema error classification updated
  - [ ] Circuit breaker thresholds reviewed
  - [ ] Graceful degradation planned
  - [ ] Fallback data sources identified

### 14. Monitoring and Alerting
- [ ] **Monitoring Setup**
  - [ ] Schema error alerts configured
  - [ ] Performance monitoring enabled
  - [ ] Query success rate tracking added
  - [ ] User impact metrics defined

- [ ] **Alert Thresholds**
  - [ ] Critical error thresholds set
  - [ ] Performance degradation limits defined
  - [ ] Recovery time objectives established

## Documentation and Communication

### 15. Documentation Updates
- [ ] **Technical Documentation**
  - [ ] API documentation updated
  - [ ] Database schema documentation revised
  - [ ] Code comments updated
  - [ ] README files modified

- [ ] **Process Documentation**
  - [ ] Migration procedures documented
  - [ ] Rollback procedures written
  - [ ] Troubleshooting guide created
  - [ ] Lessons learned documented

### 16. Team Communication
- [ ] **Pre-Change Communication**
  - [ ] Team notified of upcoming changes
  - [ ] Impact assessment shared
  - [ ] Timeline communicated
  - [ ] Responsibilities assigned

- [ ] **Change Communication**
  - [ ] Deployment notifications sent
  - [ ] Status updates provided
  - [ ] Issue escalation procedures defined
  - [ ] Success criteria communicated

## Final Approval

### 17. Review and Approval
- [ ] **Technical Review**
  - [ ] Senior developer review completed
  - [ ] Database administrator approval obtained
  - [ ] Architecture team sign-off received
  - [ ] Security team approval (if applicable)

- [ ] **Business Approval**
  - [ ] Product owner approval obtained
  - [ ] Stakeholder notification completed
  - [ ] User communication planned (if needed)
  - [ ] Maintenance window scheduled (if needed)

### 18. Go/No-Go Decision
- [ ] **All checklist items completed**: Yes/No
- [ ] **Risk assessment acceptable**: Yes/No
- [ ] **Rollback plan validated**: Yes/No
- [ ] **Team ready for deployment**: Yes/No

**Final Decision**: GO / NO-GO

**Decision Maker**: _________________
**Date**: _________________
**Signature**: _________________

## Post-Change Validation

### 19. Immediate Validation (First 30 minutes)
- [ ] **Deployment Success**
  - [ ] Schema changes applied successfully
  - [ ] Application starts without errors
  - [ ] Basic functionality verified
  - [ ] No critical alerts triggered

- [ ] **Performance Validation**
  - [ ] Page load times within acceptable range
  - [ ] Query response times normal
  - [ ] Error rates at baseline levels
  - [ ] Circuit breaker state normal

### 20. Extended Validation (First 24 hours)
- [ ] **Functional Validation**
  - [ ] All affected features working
  - [ ] Data integrity maintained
  - [ ] User workflows functioning
  - [ ] Integration points operational

- [ ] **Performance Monitoring**
  - [ ] No performance degradation detected
  - [ ] Resource usage within normal ranges
  - [ ] User experience metrics stable
  - [ ] No increase in support tickets

## Lessons Learned

### 21. Post-Implementation Review
- [ ] **What Went Well**
  - Process effectiveness: _________________
  - Tool effectiveness: _________________
  - Team coordination: _________________

- [ ] **What Could Be Improved**
  - Process gaps: _________________
  - Tool limitations: _________________
  - Communication issues: _________________

- [ ] **Action Items**
  - Process improvements: _________________
  - Tool enhancements: _________________
  - Training needs: _________________

### 22. Knowledge Sharing
- [ ] **Documentation Updated**
  - [ ] Runbook updated with new learnings
  - [ ] Best practices documented
  - [ ] Common pitfalls added to guide
  - [ ] Success patterns documented

- [ ] **Team Knowledge Transfer**
  - [ ] Team retrospective conducted
  - [ ] Lessons shared with broader team
  - [ ] Training materials updated
  - [ ] Mentoring plan for junior developers

---

**Checklist Completed By**: _________________
**Date**: _________________
**Review Status**: APPROVED / NEEDS REVISION / REJECTED
**Next Review Date**: _________________
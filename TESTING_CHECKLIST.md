# Testing Checklist

## Phase 1: Critical Fixes
- [ ] Auth import works in useProducts.ts
- [ ] Store selection persists across refreshes
- [ ] Error boundary catches and displays errors
- [ ] Error logging API works

## Phase 2: Database
- [ ] All migrations applied successfully
- [ ] New tables exist with correct schema
- [ ] RLS policies work correctly
- [ ] Materialized view refreshes

## Phase 3-4: Webhooks
- [ ] Orders webhook receives and processes data
- [ ] Products webhook logs correctly
- [ ] Webhook manager registers all webhooks
- [ ] HMAC verification works

## Phase 5: Background Jobs
- [ ] Daily analytics job runs successfully
- [ ] Hourly sales sync works
- [ ] Pricing job includes impact analysis
- [ ] Jobs are scheduled correctly

## Phase 6-7: Analytics
- [ ] Store metrics API returns real data
- [ ] Product analytics API works
- [ ] Dashboard shows real metrics
- [ ] Analytics page shows real data
- [ ] Loading states work
- [ ] Error states work

## Phase 8: Performance
- [ ] Queries are fast (< 200ms)
- [ ] No duplicate API calls
- [ ] Prefetching works
- [ ] Code splitting works

## Phase 9: UX
- [ ] Skeleton loaders show during loading
- [ ] Empty states show when no data
- [ ] Optimistic updates work
- [ ] Retry buttons work

## Phase 10: Security
- [ ] Rate limiting works
- [ ] Input validation catches bad data
- [ ] HMAC verification secure
- [ ] Audit logs created

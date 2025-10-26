# Deployment Guide

## Prerequisites
1. Supabase project created
2. Shopify app created
3. Trigger.dev account setup

## Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
NEXT_PUBLIC_APP_URL=
TRIGGER_SECRET_KEY=
```

## Database Setup

1. Run migrations in order (015-018)
2. Verify all tables created
3. Test RLS policies

## Trigger.dev Setup

1. Deploy triggers: `npm run trigger:deploy`
2. Verify schedules in dashboard
3. Test manual trigger

## Webhook Setup

1. Webhooks auto-register on OAuth
2. Verify in Shopify admin
3. Test with Shopify webhook tester

## Monitoring

- Check error_logs table daily
- Monitor webhook_logs for failures
- Review audit_logs for suspicious activity

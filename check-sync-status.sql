-- After reconnecting the store, you can trigger sync via your app's API
-- Or use this to check sync status

-- Check if sync_status table has entries for napoleon test store
SELECT 
    store_id,
    sync_type,
    status,
    total_products,
    products_synced,
    started_at,
    completed_at,
    error_message
FROM public.sync_status
WHERE store_id = '7bd653c6-387e-48fd-bf41-8b50829c07a4'
ORDER BY started_at DESC
LIMIT 5;

-- Check all stores and their status
SELECT 
    id,
    shop_domain,
    user_id,
    is_active,
    installed_at,
    updated_at,
    CASE 
        WHEN access_token IS NOT NULL THEN 'Has plain token'
        WHEN access_token_encrypted IS NOT NULL THEN 'Has encrypted token'
        ELSE 'No token'
    END as token_status
FROM public.stores
ORDER BY installed_at DESC;

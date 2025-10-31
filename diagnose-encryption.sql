-- Diagnostic: Check if encryption functions exist and work
-- Run this in Supabase SQL Editor

-- 1. Check if pgcrypto extension exists
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

-- 2. Check if encrypt_token function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('encrypt_token', 'decrypt_token');

-- 3. Test encryption (with a dummy key - replace with your actual key format)
-- This will show if the function works, but won't use your real key
SELECT encrypt_token('test_token', '12345678901234567890123456789012'::TEXT) IS NOT NULL as encryption_works;

-- 4. Check if stores table has the encrypted column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'stores' 
AND column_name IN ('access_token', 'access_token_encrypted');

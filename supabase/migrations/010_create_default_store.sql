-- Create default store for existing test users
-- This migration links authenticated users to their Shopify store
-- NOTE: Run this manually after setting ENCRYPTION_KEY in your SQL editor session

-- First, check if we have users
DO $$
DECLARE
  v_user_id UUID;
  v_store_id UUID;
  v_shop_domain TEXT := 'YOUR_SHOP_DOMAIN.myshopify.com'; -- From your .env.local
  v_access_token TEXT := 'YOUR_SHOPIFY_ACCESS_TOKEN'; -- From your .env.local
BEGIN
  -- Get the first user (your test user)
  SELECT id INTO v_user_id 
  FROM users 
  WHERE auth_user_id IS NOT NULL 
  ORDER BY created_at ASC 
  LIMIT 1;

  -- Only proceed if we found a user
  IF v_user_id IS NOT NULL THEN
    -- Check if store already exists
    SELECT id INTO v_store_id
    FROM stores
    WHERE shop_domain = v_shop_domain;

    IF v_store_id IS NULL THEN
      -- Create the store (storing token as plain text temporarily)
      INSERT INTO stores (
        user_id,
        shop_domain,
        access_token, -- Using plain text column temporarily
        scope,
        installed_at,
        is_active
      ) VALUES (
        v_user_id,
        v_shop_domain,
        v_access_token,
        'read_products,write_products,read_orders',
        NOW(),
        true
      )
      RETURNING id INTO v_store_id;

      RAISE NOTICE 'Created store % for user %', v_store_id, v_user_id;
    ELSE
      -- Update existing store to link to first user if not already linked
      UPDATE stores
      SET user_id = v_user_id,
          access_token = v_access_token,
          is_active = true,
          updated_at = NOW()
      WHERE id = v_store_id;

      RAISE NOTICE 'Updated existing store % for user %', v_store_id, v_user_id;
    END IF;

    -- Link all existing products to this store
    UPDATE products
    SET store_id = v_store_id
    WHERE store_id IS NULL;

    RAISE NOTICE 'Linked products to store %', v_store_id;
  ELSE
    RAISE NOTICE 'No authenticated users found, skipping store creation';
  END IF;
END $$;


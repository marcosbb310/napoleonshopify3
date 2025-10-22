-- If the CHECK query shows no store linked, run this to manually link them
-- Make sure to update the values from your .env.local

DO $$
DECLARE
  v_user_id UUID;
  v_store_id UUID;
  v_shop_domain TEXT := 'YOUR_SHOP_DOMAIN.myshopify.com'; -- FROM YOUR .env.local
  v_access_token TEXT := 'YOUR_SHOPIFY_ACCESS_TOKEN'; -- FROM YOUR .env.local
BEGIN
  -- Get the first authenticated user
  SELECT id INTO v_user_id 
  FROM users 
  WHERE auth_user_id IS NOT NULL 
  ORDER BY created_at ASC 
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated users found! Check auth.users and users tables.';
  END IF;

  RAISE NOTICE 'Found user: %', v_user_id;

  -- Check if store already exists
  SELECT id INTO v_store_id
  FROM stores
  WHERE shop_domain = v_shop_domain;

  IF v_store_id IS NULL THEN
    -- Create new store
    INSERT INTO stores (
      user_id,
      shop_domain,
      access_token,
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

    RAISE NOTICE 'Created new store: %', v_store_id;
  ELSE
    -- Update existing store
    UPDATE stores
    SET 
      user_id = v_user_id,
      access_token = v_access_token,
      is_active = true,
      updated_at = NOW()
    WHERE id = v_store_id;

    RAISE NOTICE 'Updated existing store: %', v_store_id;
  END IF;

  -- Link all orphaned products to this store
  UPDATE products
  SET store_id = v_store_id
  WHERE store_id IS NULL;

  RAISE NOTICE 'Done! Store % linked to user %', v_store_id, v_user_id;
END $$;


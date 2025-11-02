-- Update RLS policies to allow variant-level pricing config access

BEGIN;

-- Drop old product-based policy on pricing_config
DROP POLICY IF EXISTS pricing_config_select_own_store ON pricing_config;
DROP POLICY IF EXISTS pricing_config_update_own_store ON pricing_config;
DROP POLICY IF EXISTS pricing_config_insert_own_store ON pricing_config;
DROP POLICY IF EXISTS pricing_config_delete_own_store ON pricing_config;

-- Create new variant-based policies
CREATE POLICY pricing_config_select_own_store ON pricing_config
  FOR SELECT
  USING (
    variant_id IN (
      SELECT pv.id FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE p.store_id IN (
        SELECT id FROM stores WHERE user_id::text = auth.uid()::text
      )
    )
  );

CREATE POLICY pricing_config_update_own_store ON pricing_config
  FOR UPDATE
  USING (
    variant_id IN (
      SELECT pv.id FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE p.store_id IN (
        SELECT id FROM stores WHERE user_id::text = auth.uid()::text
      )
    )
  );

CREATE POLICY pricing_config_insert_own_store ON pricing_config
  FOR INSERT
  WITH CHECK (
    variant_id IN (
      SELECT pv.id FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE p.store_id IN (
        SELECT id FROM stores WHERE user_id::text = auth.uid()::text
      )
    )
  );

CREATE POLICY pricing_config_delete_own_store ON pricing_config
  FOR DELETE
  USING (
    variant_id IN (
      SELECT pv.id FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE p.store_id IN (
        SELECT id FROM stores WHERE user_id::text = auth.uid()::text
      )
    )
  );

COMMIT;


import type { SupabaseClient } from '@supabase/supabase-js';
import { updateShopifyPriceForStore } from './shopifyPriceUpdate';

type SupabaseAdminClient = SupabaseClient<any, any, any>;

export interface VariantRecord {
  id: string;
  product_id: string;
  store_id: string;
  shopify_id: string;
  shopify_product_id: string;
  title: string | null;
  current_price: number;
  starting_price: number | null;
}

export interface PricingConfigRecord {
  id?: string;
  variant_id: string;
  pre_smart_pricing_price: number | null;
  last_smart_pricing_price: number | null;
  auto_pricing_enabled: boolean;
  current_state?: string | null;
  next_price_change_date?: string | null;
  revert_wait_until_date?: string | null;
}

interface DisableVariantOptions {
  reason?: string;
  pricingHistoryAction?: string;
}

const DEFAULT_DISABLE_REASON = 'Smart pricing disabled';

export function resolveBaselinePrice(
  variant: VariantRecord,
  config: PricingConfigRecord | null
): number {
  if (config?.pre_smart_pricing_price != null) {
    return config.pre_smart_pricing_price;
  }

  if (variant.starting_price != null) {
    return variant.starting_price;
  }

  return variant.current_price;
}

export async function disableVariantSmartPricing(
  supabase: SupabaseAdminClient,
  variant: VariantRecord,
  config: PricingConfigRecord | null,
  options: DisableVariantOptions = {}
): Promise<{ revertedTo: number }> {
  const reason = options.reason ?? DEFAULT_DISABLE_REASON;
  const pricingHistoryAction = options.pricingHistoryAction ?? 'revert';

  const oldPrice = variant.current_price;
  const revertPrice = resolveBaselinePrice(variant, config);

  if (config?.id) {
    const { error: configUpdateError } = await supabase
      .from('pricing_config')
      .update({
        auto_pricing_enabled: false,
        last_smart_pricing_price: oldPrice,
        current_state: 'increasing',
        next_price_change_date: null,
        revert_wait_until_date: null,
      })
      .eq('id', config.id);

    if (configUpdateError) {
      throw new Error(
        `Failed to update pricing config for variant ${variant.id}: ${configUpdateError.message}`
      );
    }
  } else {
    const { error: configInsertError } = await supabase
      .from('pricing_config')
      .insert({
        variant_id: variant.id,
        auto_pricing_enabled: false,
        pre_smart_pricing_price: revertPrice,
        last_smart_pricing_price: oldPrice,
        current_state: 'increasing',
      });

    if (configInsertError) {
      throw new Error(
        `Failed to create pricing config for variant ${variant.id}: ${configInsertError.message}`
      );
    }
  }

  const { error: variantUpdateError } = await supabase
    .from('product_variants')
    .update({ current_price: revertPrice })
    .eq('id', variant.id);

  if (variantUpdateError) {
    throw new Error(
      `Failed to update variant ${variant.id} price: ${variantUpdateError.message}`
    );
  }

  const { error: historyError } = await supabase.from('pricing_history').insert({
    product_id: variant.product_id,
    variant_id: variant.id,
    store_id: variant.store_id,
    old_price: oldPrice,
    new_price: revertPrice,
    action: pricingHistoryAction,
    reason,
  });

  if (historyError) {
    throw new Error(
      `Failed to record pricing history for variant ${variant.id}: ${historyError.message}`
    );
  }

  try {
    console.log(
      '[SmartPricing] Disabling variant',
      variant.id,
      '→ Shopify product',
      variant.shopify_product_id,
      'variant',
      variant.shopify_id,
      'target price',
      revertPrice
    );
    await updateShopifyPriceForStore(variant.shopify_product_id, revertPrice, variant.store_id, {
      variantShopifyId: variant.shopify_id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown Shopify error';
    throw new Error(
      `Failed to update Shopify price for variant ${variant.id}: ${message}`
    );
  }

  return { revertedTo: revertPrice };
}

type ResumeOption = 'base' | 'last';

interface ResumeVariantOptions {
  reason?: string;
  pricingHistoryAction?: string;
}

export function resolveResumePrice(
  variant: VariantRecord,
  config: PricingConfigRecord | null,
  option: ResumeOption
): number {
  if (option === 'base') {
    return resolveBaselinePrice(variant, config);
  }

  if (config?.last_smart_pricing_price != null) {
    return config.last_smart_pricing_price;
  }

  return variant.current_price;
}

export async function resumeVariantSmartPricing(
  supabase: SupabaseAdminClient,
  variant: VariantRecord,
  config: PricingConfigRecord | null,
  option: ResumeOption,
  options: ResumeVariantOptions = {}
): Promise<{ resumedTo: number }> {
  const historyAction =
    options.pricingHistoryAction ??
    (option === 'base' ? 'resume_base' : 'resume_last');
  const reason =
    options.reason ??
    (option === 'base'
      ? 'Smart pricing resumed from base price'
      : 'Smart pricing resumed from last smart price');

  const oldPrice = variant.current_price;
  const resumePrice = resolveResumePrice(variant, config, option);

  if (config?.id) {
    const updates: Record<string, unknown> = {
      auto_pricing_enabled: true,
      last_smart_pricing_price: resumePrice,
      current_state: 'increasing',
      next_price_change_date: null,
      revert_wait_until_date: null,
    };

    if (config.pre_smart_pricing_price == null && option === 'base') {
      updates.pre_smart_pricing_price = variant.current_price;
    }

    const { error: configUpdateError } = await supabase
      .from('pricing_config')
      .update(updates)
      .eq('id', config.id);

    if (configUpdateError) {
      throw new Error(
        `Failed to update pricing config for variant ${variant.id}: ${configUpdateError.message}`
      );
    }
  } else {
    const { error: configInsertError } = await supabase
      .from('pricing_config')
      .insert({
        variant_id: variant.id,
        auto_pricing_enabled: true,
        pre_smart_pricing_price:
          option === 'base' ? variant.current_price : resumePrice,
        last_smart_pricing_price: resumePrice,
        current_state: 'increasing',
        next_price_change_date: null,
        revert_wait_until_date: null,
      });

    if (configInsertError) {
      throw new Error(
        `Failed to create pricing config for variant ${variant.id}: ${configInsertError.message}`
      );
    }
  }

  const { error: variantUpdateError } = await supabase
    .from('product_variants')
    .update({ current_price: resumePrice })
    .eq('id', variant.id);

  if (variantUpdateError) {
    throw new Error(
      `Failed to update variant ${variant.id} price: ${variantUpdateError.message}`
    );
  }

  const { error: historyError } = await supabase.from('pricing_history').insert({
    product_id: variant.product_id,
    variant_id: variant.id,
    store_id: variant.store_id,
    old_price: oldPrice,
    new_price: resumePrice,
    action: historyAction,
    reason,
  });

  if (historyError) {
    throw new Error(
      `Failed to record pricing history for variant ${variant.id}: ${historyError.message}`
    );
  }

  try {
    console.log(
      '[SmartPricing] Resuming variant',
      variant.id,
      '→ Shopify product',
      variant.shopify_product_id,
      'variant',
      variant.shopify_id,
      'target price',
      resumePrice
    );
    await updateShopifyPriceForStore(variant.shopify_product_id, resumePrice, variant.store_id, {
      variantShopifyId: variant.shopify_id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown Shopify error';
    throw new Error(
      `Failed to update Shopify price for variant ${variant.id}: ${message}`
    );
  }

  return { resumedTo: resumePrice };
}




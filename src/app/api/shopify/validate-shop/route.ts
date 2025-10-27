import { NextRequest, NextResponse } from 'next/server';
import { validateShopDomain } from '@/features/shopify-oauth/services/shopValidationService';
import type { ValidationResult } from '@/features/shopify-oauth/types';

/**
 * POST /api/shopify/validate-shop
 * 
 * Validates a Shopify shop domain
 * 
 * Request body:
 * {
 *   "domain": "mystore.myshopify.com"
 * }
 * 
 * Response:
 * {
 *   "isValid": true,
 *   "shopDomain": "mystore.myshopify.com"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain } = body;

    if (!domain) {
      return NextResponse.json<ValidationResult>(
        {
          isValid: false,
          shopDomain: '',
          error: 'Domain is required',
          errorCode: 'MISSING_DOMAIN',
        },
        { status: 400 }
      );
    }

    // Validate the shop domain
    const result = await validateShopDomain(domain);

    return NextResponse.json<ValidationResult>(result);

  } catch (error) {
    console.error('❌ Shop validation error:', error);
    
    return NextResponse.json<ValidationResult>(
      {
        isValid: false,
        shopDomain: '',
        error: 'Validation failed',
        errorCode: 'VALIDATION_ERROR',
        suggestion: 'Please check the domain and try again',
      },
      { status: 500 }
    );
  }
}

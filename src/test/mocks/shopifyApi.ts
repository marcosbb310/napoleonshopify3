// Mock Shopify API responses
export const mockShopifyProducts = {
  products: [
    {
      id: 123,
      title: 'Test Product',
      handle: 'test-product',
      body_html: '<p>Test description</p>',
      vendor: 'Test Vendor',
      product_type: 'Test Type',
      tags: 'test, product',
      status: 'active',
      images: [
        {
          id: 456,
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
          width: 800,
          height: 800,
        }
      ],
      variants: [
        {
          id: 789,
          title: 'Default',
          price: '29.99',
          compare_at_price: null,
          sku: 'TEST-SKU',
          inventory_quantity: 10,
          inventory_management: 'shopify',
          weight: 1.0,
          weight_unit: 'kg',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        }
      ],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }
  ]
};

export const mockWebhookPayload = {
  id: 123,
  title: 'Test Product',
  variants: [
    {
      id: 789,
      price: '34.99', // Updated price
    }
  ]
};

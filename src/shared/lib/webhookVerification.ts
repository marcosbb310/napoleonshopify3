import crypto from 'crypto';

export function verifyShopifyWebhook(
  body: string,
  hmac: string,
  secret: string
): boolean {
  const calculatedHmac = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(hmac),
    Buffer.from(calculatedHmac)
  );
}

'use strict';

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

function safeJson(v) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return null;
  }
}

async function makeUniqueOrderCode() {
  for (let i = 0; i < 10; i++) {
    const n = Math.floor(1000 + Math.random() * 9000);
    const code = `MBQ-${n}`;
    const existing = await strapi.entityService.findMany('api::merch-order.merch-order', {
      filters: { orderCode: code },
      fields: ['id'],
      limit: 1,
      publicationState: 'preview',
    });
    if (!existing || existing.length === 0) return code;
  }
  return `MBQ-${Date.now()}`;
}

function normalizeItemSlotIndex(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 3) return null;
  return n;
}

module.exports = {
  async createCheckout(ctx) {
    const body = ctx.request.body || {};
    const bandSlug = String(body.bandSlug || '').trim().toLowerCase();
    const itemSlotIndex = normalizeItemSlotIndex(body.itemSlotIndex);
    const selectedSize = body.selectedSize != null ? String(body.selectedSize).trim() : null;

    if (!bandSlug) return ctx.badRequest('bandSlug is required');
    if (!itemSlotIndex) return ctx.badRequest('itemSlotIndex must be 1-3');

    const bands = await strapi.entityService.findMany('api::band.band', {
      filters: { slug: bandSlug },
      fields: ['id', 'name', 'slug', 'stripeAccountId', 'paymentsEnabled', 'stripeOnboardingComplete', 'merchConcierge'],
      limit: 1,
      publicationState: 'preview',
    });

    const band = bands?.[0] || null;
    if (!band) return ctx.notFound('Band not found');

    if (!band.paymentsEnabled || !band.stripeOnboardingComplete || !band.stripeAccountId) {
      return ctx.badRequest('Payments not enabled for this band');
    }

    const mc = safeJson(band.merchConcierge) || {};

    if (mc.enabled !== true) return ctx.badRequest('Merch Concierge is not enabled');
    if (mc.staffReadyConfirmed !== true) return ctx.badRequest('Merch Concierge is not ready yet');

    const pickupInstructions = String(mc.pickupInstructions || '').trim();
    if (!pickupInstructions) return ctx.badRequest('pickupInstructions is required');

    const items = Array.isArray(mc.merchItems) ? mc.merchItems : [];
    const idx = itemSlotIndex - 1;
    const item = items[idx] || null;
    if (!item) return ctx.badRequest('Invalid merch item');

    const title = String(item.title || '').trim();
    const description = String(item.description || '').trim();
    const imageUrl = item.imageUrl ? String(item.imageUrl) : null;
    const priceCents = Number(item.priceCents || 0);

    if (!title) return ctx.badRequest('Item title missing');
    if (!priceCents || priceCents < 50) return ctx.badRequest('Invalid price');

    // Validate stock now (best-effort pre-check; final check is webhook)
    if (item.sizesEnabled === true) {
      const stock = item.sizeStock && typeof item.sizeStock === 'object' ? item.sizeStock : {};
      const sz = String(selectedSize || '').trim();
      if (!sz) return ctx.badRequest('Size is required');
      const cur = Number(stock?.[sz] || 0);
      if (cur <= 0) return ctx.badRequest('Sold out');
    } else {
      const cur = Number(item.availableQty || 0);
      if (cur <= 0) return ctx.badRequest('Sold out');
    }

    const orderCode = await makeUniqueOrderCode();

    // Create pending merch order
    const merchOrder = await strapi.entityService.create('api::merch-order.merch-order', {
      data: {
        band: band.id,
        orderCode,
        status: 'pending',
        bandNameSnapshot: band.name,
        bandSlugSnapshot: band.slug,
        itemSlotIndex,
        itemTitleSnapshot: title,
        selectedSize: item.sizesEnabled === true ? String(selectedSize || '').trim() : null,
        quantity: 1,
        priceCentsSnapshot: priceCents,
        pickupInstructionsSnapshot: pickupInstructions,
      },
    });

    const publicAppUrl = String(process.env.PUBLIC_APP_URL || '').replace(/\/+$/, '');

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${band.name} — ${title}`,
                description: description || undefined,
                images: imageUrl ? [imageUrl] : undefined,
              },
              unit_amount: priceCents,
            },
            quantity: 1,
          },
        ],
        success_url: `${publicAppUrl}/pickup/${orderCode}?success=1`,
        cancel_url: `${publicAppUrl}/${band.slug}?canceled=1`,
        metadata: {
          merchOrderId: String(merchOrder.id),
          bandId: String(band.id),
          itemSlotIndex: String(itemSlotIndex),
        },
      },
      {
        stripeAccount: band.stripeAccountId,
      }
    );

    await strapi.entityService.update('api::merch-order.merch-order', merchOrder.id, {
      data: {
        stripeCheckoutSessionId: session.id || null,
        stripePaymentIntentId: session.payment_intent || null,
      },
    });

    ctx.body = { checkoutUrl: session.url, orderCode };
  },

  async getOrder(ctx) {
    const code = String(ctx.params.orderCode || '').trim();
    if (!code) return ctx.badRequest('orderCode required');

    const rows = await strapi.entityService.findMany('api::merch-order.merch-order', {
      filters: { orderCode: code },
      fields: [
        'id',
        'orderCode',
        'status',
        'bandNameSnapshot',
        'bandSlugSnapshot',
        'itemSlotIndex',
        'itemTitleSnapshot',
        'selectedSize',
        'quantity',
        'priceCentsSnapshot',
        'pickupInstructionsSnapshot',
        'customerName',
        'customerEmail',
        'paidAt',
        'refundedAt',
        'errorMessage',
        'createdAt',
      ],
      limit: 1,
      publicationState: 'preview',
    });

    const order = rows?.[0] || null;
    if (!order) return ctx.notFound('Order not found');

    ctx.body = { data: order };
  },
};

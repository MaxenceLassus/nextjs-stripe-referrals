import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import Stripe from 'stripe';

/**
 * What this module actually puts on the wire.
 *
 * The real Stripe SDK, serializing real parameters, against a local server that
 * records the requests. Every other test here mocks the SDK and therefore
 * proves only that we called our own functions in the right order; this one
 * proves the bytes.
 *
 * That distinction is not academic. The three things most likely to be silently
 * wrong in a Stripe integration are all invisible to a mock:
 *
 *  - `duration: 'forever'` on the coupon. A `once` coupon is consumed by one
 *    invoice and disappears, so the discount depends on something re-attaching
 *    it before every renewal, and any gap is a full-price charge that nothing
 *    reports.
 *  - `discounts: ''` as the way to remove a discount. An empty array or a
 *    missing field means "inherit", not "remove", and the customer keeps a
 *    discount they stopped earning.
 *  - `proration_behavior: 'none'`. Without it a mid-cycle tier change can
 *    generate a credit note or an immediate charge for time already served.
 *
 * What it does NOT prove: how Stripe responds, or that an invoice really comes
 * out lower. That needs a live test key and is the checklist in the README.
 */

interface Recorded {
  method: string;
  path: string;
  body: URLSearchParams;
}

let server: Server;
let port: number;
const recorded: Recorded[] = [];
let respond: (path: string) => { status: number; body: unknown } = () => ({
  status: 200,
  body: {},
});

beforeAll(async () => {
  server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => (raw += chunk));
    request.on('end', () => {
      recorded.push({
        method: request.method ?? '',
        path: request.url ?? '',
        body: new URLSearchParams(raw),
      });
      const { status, body } = respond(request.url ?? '');
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as { port: number }).port;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// A real client, pointed at the recorder rather than at Stripe.
vi.mock('./client', () => ({
  stripe: () =>
    new Stripe('sk_test_wire', {
      apiVersion: '2025-08-27.basil',
      host: '127.0.0.1',
      port: (globalThis as unknown as { __wirePort: number }).__wirePort,
      protocol: 'http',
      maxNetworkRetries: 0,
    }),
}));

const findUnique = vi.fn();
const update = vi.fn();
const countActiveReferrals = vi.fn();

vi.mock('../db', () => ({
  db: { referralCustomer: { findUnique, update }, referral: { findUnique: vi.fn() } },
}));
vi.mock('../queries', () => ({ countActiveReferrals }));

const { syncDiscountFor } = await import('./discount');
const { ensureCoupon, resetCouponCache } = await import('./coupons');

beforeEach(() => {
  (globalThis as unknown as { __wirePort: number }).__wirePort = port;
  recorded.length = 0;
  resetCouponCache();
  findUnique.mockReset();
  update.mockReset().mockResolvedValue({});
  countActiveReferrals.mockReset();
  respond = () => ({ status: 200, body: {} });
});

describe('coupon creation, on the wire', () => {
  it('creates a forever coupon whose id names its percentage', async () => {
    respond = (path) =>
      path.includes('/coupons/')
        ? { status: 404, body: { error: { code: 'resource_missing', type: 'invalid_request_error' } } }
        : { status: 200, body: { id: 'referral_off_40', percent_off: 40, duration: 'forever' } };

    await ensureCoupon(40);

    const created = recorded.find((entry) => entry.method === 'POST');
    expect(created?.path).toBe('/v1/coupons');
    expect(created?.body.get('id')).toBe('referral_off_40');
    expect(created?.body.get('percent_off')).toBe('40');
    // The property the whole design rests on.
    expect(created?.body.get('duration')).toBe('forever');
  });

  it('reuses an existing coupon instead of creating a second one', async () => {
    respond = () => ({
      status: 200,
      body: { id: 'referral_off_20', percent_off: 20, duration: 'forever' },
    });

    await ensureCoupon(20);

    expect(recorded.filter((entry) => entry.method === 'POST')).toHaveLength(0);
    expect(recorded[0]?.path).toBe('/v1/coupons/referral_off_20');
  });

  it('refuses a coupon that exists with a different percentage', async () => {
    // Somebody hand-made `referral_off_20` as 5% off in the dashboard. Using it
    // would discount by an amount nobody configured, on every invoice, quietly.
    respond = () => ({
      status: 200,
      body: { id: 'referral_off_20', percent_off: 5, duration: 'forever' },
    });

    await expect(ensureCoupon(20)).rejects.toThrow(/percent_off=5/);
  });

  it('caches within the process rather than asking Stripe on every webhook', async () => {
    respond = () => ({
      status: 200,
      body: { id: 'referral_off_60', percent_off: 60, duration: 'forever' },
    });

    await ensureCoupon(60);
    await ensureCoupon(60);

    expect(recorded).toHaveLength(1);
  });
});

describe('discount writes, on the wire', () => {
  it('sends the coupon and suppresses proration when a tier is earned', async () => {
    findUnique.mockResolvedValue({
      stripeSubscriptionId: 'sub_live',
      appliedPercent: 0,
      status: 'ACTIVE',
      lastSyncError: null,
    });
    countActiveReferrals.mockResolvedValue(1);
    respond = (path) =>
      path.includes('/coupons/')
        ? { status: 200, body: { id: 'referral_off_20', percent_off: 20, duration: 'forever' } }
        : { status: 200, body: { id: 'sub_live' } };

    await syncDiscountFor('u1');

    const call = recorded.find((entry) => entry.path === '/v1/subscriptions/sub_live');
    expect(call?.body.get('discounts[0][coupon]')).toBe('referral_off_20');
    expect(call?.body.get('proration_behavior')).toBe('none');
  });

  it('sends an empty discounts value to actually remove the discount', async () => {
    // Not an empty array and not an omitted field: both mean "inherit from the
    // customer" to Stripe, and would leave the discount in place.
    findUnique.mockResolvedValue({
      stripeSubscriptionId: 'sub_live',
      appliedPercent: 20,
      status: 'ACTIVE',
      lastSyncError: null,
    });
    countActiveReferrals.mockResolvedValue(0);
    respond = () => ({ status: 200, body: { id: 'sub_live' } });

    await syncDiscountFor('u1');

    const call = recorded.find((entry) => entry.path === '/v1/subscriptions/sub_live');
    expect(call?.body.get('discounts')).toBe('');
    expect(call?.body.get('discounts[0][coupon]')).toBeNull();
    expect(call?.body.get('proration_behavior')).toBe('none');
  });

  it('reaches 100 percent off with a real coupon rather than falling through', async () => {
    findUnique.mockResolvedValue({
      stripeSubscriptionId: 'sub_live',
      appliedPercent: 80,
      status: 'ACTIVE',
      lastSyncError: null,
    });
    countActiveReferrals.mockResolvedValue(5);
    respond = (path) =>
      path.includes('/coupons/')
        ? { status: 200, body: { id: 'referral_off_100', percent_off: 100, duration: 'forever' } }
        : { status: 200, body: { id: 'sub_live' } };

    await syncDiscountFor('u1');

    const call = recorded.find((entry) => entry.path === '/v1/subscriptions/sub_live');
    expect(call?.body.get('discounts[0][coupon]')).toBe('referral_off_100');
  });

  it('records the reason when Stripe rejects the write', async () => {
    findUnique.mockResolvedValue({
      stripeSubscriptionId: 'sub_gone',
      appliedPercent: 0,
      status: 'ACTIVE',
      lastSyncError: null,
    });
    countActiveReferrals.mockResolvedValue(1);
    respond = (path) =>
      path.includes('/coupons/')
        ? { status: 200, body: { id: 'referral_off_20', percent_off: 20, duration: 'forever' } }
        : {
            status: 404,
            body: {
              error: { code: 'resource_missing', message: 'No such subscription: sub_gone' },
            },
          };

    const outcome = await syncDiscountFor('u1');

    expect(outcome).toMatchObject({ changed: false, reason: 'failed' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastSyncError: expect.stringContaining('sub_gone') }),
      }),
    );
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

const eventCreate = vi.fn();
const eventDelete = vi.fn();
const constructEventAsync = vi.fn();
const linkCustomer = vi.fn();
const userIdForCustomer = vi.fn();
const refreshSubscriptionState = vi.fn();

vi.mock('../db', () => ({
  db: { processedStripeEvent: { create: eventCreate, delete: eventDelete } },
}));
vi.mock('./client', () => ({ stripe: () => ({ webhooks: { constructEventAsync } }) }));
vi.mock('./status', () => ({ linkCustomer, userIdForCustomer }));
vi.mock('./refresh', () => ({ refreshSubscriptionState }));

const { POST } = await import('./webhook');

function request(body = '{}', signature: string | null = 't=1,v1=stub'): Request {
  return new Request('https://tests.invalid/api/referrals/webhook', {
    method: 'POST',
    headers: signature ? { 'stripe-signature': signature } : {},
    body,
  });
}

const event = (type: string, object: unknown): Stripe.Event =>
  ({ id: 'evt_1', type, data: { object } }) as Stripe.Event;

beforeEach(() => {
  for (const fn of [eventCreate, eventDelete, constructEventAsync, linkCustomer, userIdForCustomer, refreshSubscriptionState])
    fn.mockReset();
  eventCreate.mockResolvedValue({});
  eventDelete.mockResolvedValue({});
  refreshSubscriptionState.mockResolvedValue(true);
});

describe('webhook security', () => {
  it('rejects a request with no signature', async () => {
    expect((await POST(request('{}', null))).status).toBe(400);
    expect(constructEventAsync).not.toHaveBeenCalled();
  });

  it('rejects a signature that does not verify', async () => {
    // Without this, anyone who finds the URL can cancel a competitor's
    // discount, or grant themselves one, by posting JSON.
    constructEventAsync.mockRejectedValue(new Error('no match'));

    expect((await POST(request())).status).toBe(400);
    expect(refreshSubscriptionState).not.toHaveBeenCalled();
  });

  it('verifies against the raw body, not a re-serialised object', async () => {
    // Re-encoding the JSON changes the bytes and the signature stops matching.
    const raw = '{"id":"evt_1",  "spacing":"preserved"}';
    constructEventAsync.mockResolvedValue(event('ping', {}));

    await POST(request(raw));

    expect(constructEventAsync).toHaveBeenCalledWith(raw, 't=1,v1=stub', expect.any(String));
  });
});

describe('webhook idempotency', () => {
  it('drops a redelivery instead of handling it twice', async () => {
    constructEventAsync.mockResolvedValue(
      event('customer.subscription.updated', { id: 'sub_1', customer: 'cus_1', metadata: { userId: 'u1' } }),
    );
    eventCreate.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 'P2002' }));

    const response = await POST(request());

    expect(await response.json()).toEqual({ received: true, duplicate: true });
    expect(refreshSubscriptionState).not.toHaveBeenCalled();
  });

  it('releases the idempotency record when handling fails, so Stripe can retry', async () => {
    // Without the release, one transient database blip drops the event for
    // good and a referrer keeps a discount they stopped earning.
    constructEventAsync.mockResolvedValue(
      event('customer.subscription.updated', { id: 'sub_1', customer: 'cus_1', metadata: { userId: 'u1' } }),
    );
    refreshSubscriptionState.mockRejectedValue(new Error('database gone'));

    expect((await POST(request())).status).toBe(500);
    expect(eventDelete).toHaveBeenCalledWith({ where: { id: 'evt_1' } });
  });
});

describe('webhook routing', () => {
  it('binds the customer to the account on checkout completion', async () => {
    constructEventAsync.mockResolvedValue(
      event('checkout.session.completed', { client_reference_id: 'u1', customer: 'cus_1' }),
    );

    await POST(request());

    expect(linkCustomer).toHaveBeenCalledWith('u1', 'cus_1');
    expect(refreshSubscriptionState).toHaveBeenCalledWith('u1');
  });

  it('re-reads state rather than trusting the status in the payload', async () => {
    // The ordering fix. The event says *which* account changed; what it
    // changed to is read back from the API, so an event delivered late cannot
    // overwrite a newer truth and move a discount on a third party's account.
    constructEventAsync.mockResolvedValue(
      event('customer.subscription.updated', {
        id: 'sub_1',
        customer: 'cus_1',
        status: 'past_due',
        metadata: { userId: 'u1' },
      }),
    );

    await POST(request());

    expect(refreshSubscriptionState).toHaveBeenCalledWith('u1');
  });

  it('handles a cancellation', async () => {
    constructEventAsync.mockResolvedValue(
      event('customer.subscription.deleted', { id: 'sub_1', customer: 'cus_1', metadata: { userId: 'u1' } }),
    );

    await POST(request());

    expect(refreshSubscriptionState).toHaveBeenCalledWith('u1');
  });

  it('acts on a failed payment as soon as the invoice event arrives', async () => {
    constructEventAsync.mockResolvedValue(event('invoice.payment_failed', { customer: 'cus_1' }));
    userIdForCustomer.mockResolvedValue('u1');

    await POST(request());

    expect(refreshSubscriptionState).toHaveBeenCalledWith('u1');
  });

  it('acts on a recovered payment just as promptly', async () => {
    constructEventAsync.mockResolvedValue(event('invoice.paid', { customer: 'cus_1' }));
    userIdForCustomer.mockResolvedValue('u1');

    await POST(request());

    expect(refreshSubscriptionState).toHaveBeenCalledWith('u1');
  });

  it('falls back to the stored customer for a subscription made by hand in Stripe', async () => {
    constructEventAsync.mockResolvedValue(
      event('customer.subscription.updated', { id: 'sub_1', customer: 'cus_1', metadata: {} }),
    );
    userIdForCustomer.mockResolvedValue('u1');

    await POST(request());

    expect(refreshSubscriptionState).toHaveBeenCalledWith('u1');
  });

  it('acknowledges an unknown customer without failing the delivery', async () => {
    constructEventAsync.mockResolvedValue(event('invoice.paid', { customer: 'cus_unknown' }));
    userIdForCustomer.mockResolvedValue(null);

    expect((await POST(request())).status).toBe(200);
    expect(refreshSubscriptionState).not.toHaveBeenCalled();
  });

  it('acknowledges an event it has no opinion about', async () => {
    // A non-2xx would make Stripe retry an event nothing here handles, forever.
    constructEventAsync.mockResolvedValue(event('customer.discount.created', {}));

    expect((await POST(request())).status).toBe(200);
  });
});

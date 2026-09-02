import { describe, it, expect, vi } from 'vitest';
import { createPushoverProvider, PushoverConfigSchema } from '../src/providers/pushover.js';
import { runNotifyProviderConformance } from '@app/notify/test-harness';
import { pushoverProvider } from '../src/providers/pushover.js';

runNotifyProviderConformance(pushoverProvider, {
  validConfig: { apiToken: 'app-token', userKey: 'user-key' },
  sendFixture: {
    message: { severity: 'info', topic: 'tt-test', title: 'Test' },
    buildProvider: (transport) => {
      const fetchImpl = (async (...args: unknown[]) => {
        transport.calls.push(args);
        return new Response('{"status":1}', { status: 200 });
      }) as unknown as typeof fetch;
      return createPushoverProvider({ fetchImpl });
    },
  },
});

describe('pushover provider', () => {
  it('schema rejects empty token/key', () => {
    expect(() => PushoverConfigSchema.parse({ apiToken: '', userKey: '' })).toThrow();
  });

  it('POSTs form-encoded token/user/title/message/priority', async () => {
    let body = '';
    const fetchImpl = vi.fn(async (_url: string, init: { body: string }) => {
      body = init.body;
      return new Response('{"status":1}', { status: 200 });
    }) as unknown as typeof fetch;
    const provider = createPushoverProvider({ fetchImpl });
    await provider.send({
      config: { apiToken: 'app-token', userKey: 'user-key' },
      message: {
        severity: 'error',
        topic: 'orphan-order',
        title: 'Untracked order on Binance',
        profile: 'RealNet-Momentum',
        symbol: 'BTCUSDT',
        body: 'An order exists on the exchange with no matching local row.',
        fields: [{ label: 'Order ID', value: '91823' }],
      },
    });
    const params = new URLSearchParams(body);
    expect(params.get('token')).toBe('app-token');
    expect(params.get('user')).toBe('user-key');
    expect(params.get('title')).toBe('Untracked order on Binance');
    expect(params.get('priority')).toBe('1');
    expect(params.get('message')).toContain('RealNet-Momentum · BTCUSDT');
    expect(params.get('message')).toContain('Order ID: 91823');
  });

  it('throws on non-2xx', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('no', { status: 500 }),
    ) as unknown as typeof fetch;
    const provider = createPushoverProvider({ fetchImpl });
    await expect(
      provider.send({
        config: { apiToken: 'app-token', userKey: 'user-key' },
        message: { severity: 'info', topic: 't', title: 'p' },
      }),
    ).rejects.toThrow(/Pushover notify failed/);
  });
});

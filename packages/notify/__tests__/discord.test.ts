import { describe, it, expect, vi } from 'vitest';
import { createDiscordProvider, DiscordConfigSchema } from '../src/providers/discord.js';
import { runNotifyProviderConformance } from '@app/notify/test-harness';
import { discordProvider } from '../src/providers/discord.js';

runNotifyProviderConformance(discordProvider, {
  validConfig: { webhookUrl: 'https://discord.com/api/webhooks/1/abc' },
  sendFixture: {
    message: { severity: 'info', topic: 'tt-test', title: 'Test' },
    buildProvider: (transport) => {
      const fetchImpl = (async (...args: unknown[]) => {
        transport.calls.push(args);
        return new Response('ok', { status: 200 });
      }) as unknown as typeof fetch;
      return createDiscordProvider({ fetchImpl });
    },
  },
});

describe('discord provider', () => {
  it('schema rejects non-URL input', () => {
    expect(() => DiscordConfigSchema.parse({ webhookUrl: 'not-a-url' })).toThrow();
  });

  it('POSTs an embed with title, context, body field, and colour by severity', async () => {
    let body: Record<string, unknown> = {};
    const fetchImpl = vi.fn(async (_url: string, init: { body: string }) => {
      body = JSON.parse(init.body) as Record<string, unknown>;
      return new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;
    const provider = createDiscordProvider({ fetchImpl });
    await provider.send({
      config: { webhookUrl: 'https://discord.com/api/webhooks/1/abc', username: 'trading-bot' },
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
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/1/abc',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(body['username']).toBe('trading-bot');
    const embeds = body['embeds'] as Record<string, unknown>[];
    expect(embeds).toHaveLength(1);
    expect(embeds[0]?.['title']).toBe('Untracked order on Binance');
    expect(embeds[0]?.['description']).toBe('RealNet-Momentum · BTCUSDT');
    expect(embeds[0]?.['color']).toBe(0xe53935);
    const fields = embeds[0]?.['fields'] as Record<string, unknown>[];
    expect(fields[0]).toMatchObject({ name: 'Detail' });
    expect(fields[1]).toMatchObject({ name: 'Order ID', value: '91823' });
  });

  it('sets the embed url when the message carries a link, omits it otherwise', async () => {
    let bodyWithLink: Record<string, unknown> = {};
    let bodyWithoutLink: Record<string, unknown> = {};
    const capture = (target: { current: Record<string, unknown> }) =>
      vi.fn(async (_url: string, init: { body: string }) => {
        target.current = JSON.parse(init.body) as Record<string, unknown>;
        return new Response('ok', { status: 200 });
      }) as unknown as typeof fetch;

    const withLinkTarget = { current: bodyWithLink };
    await createDiscordProvider({ fetchImpl: capture(withLinkTarget) }).send({
      config: { webhookUrl: 'https://discord.com/api/webhooks/1/abc' },
      message: { severity: 'info', topic: 't', title: 'T', link: 'https://example.com/run/1' },
    });
    bodyWithLink = withLinkTarget.current;
    const embedWithLink = (bodyWithLink['embeds'] as Record<string, unknown>[])[0];
    expect(embedWithLink?.['url']).toBe('https://example.com/run/1');

    const withoutLinkTarget = { current: bodyWithoutLink };
    await createDiscordProvider({ fetchImpl: capture(withoutLinkTarget) }).send({
      config: { webhookUrl: 'https://discord.com/api/webhooks/1/abc' },
      message: { severity: 'info', topic: 't', title: 'T' },
    });
    bodyWithoutLink = withoutLinkTarget.current;
    const embedWithoutLink = (bodyWithoutLink['embeds'] as Record<string, unknown>[])[0];
    expect(embedWithoutLink?.['url']).toBeUndefined();
  });

  it('throws on non-2xx', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('no', { status: 500 }),
    ) as unknown as typeof fetch;
    const provider = createDiscordProvider({ fetchImpl });
    await expect(
      provider.send({
        config: { webhookUrl: 'https://discord.com/api/webhooks/1/abc' },
        message: { severity: 'info', topic: 't', title: 'p' },
      }),
    ).rejects.toThrow(/Discord webhook failed/);
  });
});

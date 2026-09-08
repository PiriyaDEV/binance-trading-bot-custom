// Discord notify provider — Incoming Webhook URL, rendered as an embed.
//
// Config:
//   { webhookUrl: string, username?: string }
//
// Source: https://discord.com/developers/docs/resources/webhook#execute-webhook

import { z } from 'zod';
import type { NotifyProvider } from '../contract.js';
import { messageParts } from '../format.js';

/** Per-profile Discord config; `webhookUrl` is the only true secret. */
export const DiscordConfigSchema = z.object({
  webhookUrl: z
    .url()
    .describe(
      'Discord Incoming Webhook URL (https://discord.com/api/webhooks/...). Create one under Channel Settings → Integrations → Webhooks. Anyone with this URL can post to the channel, so keep it secret.',
    ),
  username: z
    .string()
    .optional()
    .describe('Optional sender name shown on each message, e.g. trading-bot.'),
});

/**
 * Compile-time mirror of {@link DiscordConfigSchema}. Pinned to `z.infer<>` so
 * the type cannot drift from the runtime validator.
 */
export type DiscordConfig = z.infer<typeof DiscordConfigSchema>;

/** Lets tests inject a mock `fetch`; production wires the platform `fetch`. */
export interface DiscordProviderOptions {
  readonly fetchImpl?: typeof fetch;
}

/** Discord embed side-bar colour per severity (decimal, not hex string — the API requires an integer). */
const EMBED_COLOR: Record<'info' | 'warn' | 'error', number> = {
  info: 0x2196f3,
  warn: 0xffb300,
  error: 0xe53935,
};

/**
 * Factory rather than singleton so tests can swap `fetchImpl`. The exported
 * `discordProvider` calls this with no overrides for production.
 */
export const createDiscordProvider = (
  opts: DiscordProviderOptions = {},
): NotifyProvider<DiscordConfig> => {
  const fetchImpl = opts.fetchImpl ?? fetch;
  return {
    name: 'discord',
    version: '1.0.0',
    displayName: 'Discord (Incoming Webhook)',
    secretFields: ['webhookUrl'],
    configSchema: DiscordConfigSchema,
    async send({ config, message }) {
      const parts = messageParts(message);
      // `description` already carries the profile/symbol context line, so the
      // body gets its own leading field rather than crowding that line.
      const fields = [
        ...(parts.body ? [{ name: 'Detail', value: parts.body, inline: false }] : []),
        ...parts.fields.map((f) => ({ name: f.label, value: f.value, inline: true })),
      ];
      const embed: Record<string, unknown> = {
        title: parts.title,
        color: EMBED_COLOR[message.severity],
        ...(parts.context ? { description: parts.context } : {}),
        ...(fields.length > 0 ? { fields } : {}),
        ...(parts.link ? { url: parts.link } : {}),
      };
      const body: Record<string, unknown> = { embeds: [embed] };
      if (config.username) body['username'] = config.username;
      const res = await fetchImpl(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`Discord webhook failed: ${res.status} ${res.statusText}`);
      }
    },
  };
};

/** Production singleton bound to the platform `fetch`. */
export const discordProvider = createDiscordProvider();

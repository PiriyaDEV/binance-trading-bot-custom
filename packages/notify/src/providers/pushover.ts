// Pushover notify provider — mobile push notifications via the Pushover API.
//
// Config:
//   { apiToken: string, userKey: string }
//
// Source: https://pushover.net/api

import { z } from 'zod';
import type { NotifyProvider } from '../contract.js';
import { messageParts } from '../format.js';

const PUSHOVER_API_URL = 'https://api.pushover.net/1/messages.json';

/** Per-profile Pushover config; both fields are secrets Pushover issues per app/user. */
export const PushoverConfigSchema = z.object({
  apiToken: z
    .string()
    .min(1)
    .describe('Pushover Application API Token, from your app at pushover.net/apps.'),
  userKey: z.string().min(1).describe('Pushover User Key, from your account at pushover.net.'),
});

/**
 * Compile-time mirror of {@link PushoverConfigSchema}. Pinned to `z.infer<>`
 * so the type cannot drift from the runtime validator.
 */
export type PushoverConfig = z.infer<typeof PushoverConfigSchema>;

/** Lets tests inject a mock `fetch`; production wires the platform `fetch`. */
export interface PushoverProviderOptions {
  readonly fetchImpl?: typeof fetch;
}

/** Pushover priority: -1 quiet for info, 0 normal for warn, 1 high (bypasses quiet hours) for error. */
const PRIORITY: Record<'info' | 'warn' | 'error', string> = {
  info: '-1',
  warn: '0',
  error: '1',
};

/**
 * Factory rather than singleton so tests can swap `fetchImpl`. The exported
 * `pushoverProvider` calls this with no overrides for production.
 */
export const createPushoverProvider = (
  opts: PushoverProviderOptions = {},
): NotifyProvider<PushoverConfig> => {
  const fetchImpl = opts.fetchImpl ?? fetch;
  return {
    name: 'pushover',
    version: '1.0.0',
    displayName: 'Pushover',
    secretFields: ['apiToken', 'userKey'],
    configSchema: PushoverConfigSchema,
    async send({ config, message }) {
      const parts = messageParts(message);
      const lines = [
        ...(parts.context ? [parts.context] : []),
        ...(parts.body ? [parts.body] : []),
        ...parts.fields.map((f) => `${f.label}: ${f.value}`),
      ];
      const form = new URLSearchParams({
        token: config.apiToken,
        user: config.userKey,
        title: parts.title,
        message: lines.length > 0 ? lines.join('\n') : parts.title,
        priority: PRIORITY[message.severity],
        ...(parts.link ? { url: parts.link, url_title: 'Open' } : {}),
      });
      const res = await fetchImpl(PUSHOVER_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      if (!res.ok) {
        throw new Error(`Pushover notify failed: ${res.status} ${res.statusText}`);
      }
    },
  };
};

/** Production singleton bound to the platform `fetch`. */
export const pushoverProvider = createPushoverProvider();

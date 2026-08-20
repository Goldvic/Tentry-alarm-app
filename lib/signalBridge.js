/**
 * Signal bridge — ntfy long-poll + HTTP poll while the keep-alive FGS is up.
 * Does NOT depend on Expo Push.
 */

import { Platform } from 'react-native';
import { KEYS, getString, getJSON, setString, setJSON } from './storage';
import {
  extractPushPayload,
  buildSignalText,
  presentAlarmNotification,
  createAlarmChannel,
} from './notifications';
import { launchAppOverlay } from './overlayLauncher';

export const BRIDGE_KEYS = {
  NTFY_TOPIC: 'bridge_ntfy_topic',
  NTFY_SERVER: 'bridge_ntfy_server',
  POLL_URL: 'bridge_poll_url',
  POLL_INTERVAL_MS: 'bridge_poll_interval_ms',
  POLL_API_KEY: 'bridge_poll_api_key', // sent as X-Entry-Bot-Key
  BRIDGE_ENABLED: 'bridge_enabled', // 'ntfy' | 'poll' | 'off'
  LAST_SIGNAL_ID: 'bridge_last_signal_id',
};

const DEFAULT_NTFY_SERVER = 'https://ntfy.sh';
const DEFAULT_POLL_MS = 10000;

let bridgeAbort = null;
let running = false;
let onSignalCallback = null;

export function setSignalHandler(fn) {
  onSignalCallback = fn;
}

/** Stable content fingerprint — same symbol/action/levels = same signal. */
function contentFingerprint(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const norm = (v) => {
    if (v === undefined || v === null || v === '') return '';
    const n = Number(v);
    if (!isNaN(n) && String(v).trim() !== '') return String(Math.round(n * 1e8) / 1e8);
    return String(v).trim().toUpperCase();
  };
  return [
    'fp',
    norm(payload.symbol),
    norm(payload.action),
    norm(payload.entry || payload.entry_price),
    norm(payload.sl || payload.stop_price),
    norm(payload.tp || payload.take_profit_price || payload.tp1_price),
  ].join('|');
}

function signalId(payload, raw) {
  if (!payload || typeof payload !== 'object') return null;
  const serverId =
    raw?.id ??
    raw?.message_id ??
    payload.id ??
    payload.message_id ??
    payload.alert_id ??
    null;
  // Prefer stable server id when present; always also compute content fp for dedupe
  if (serverId !== undefined && serverId !== null && serverId !== '') {
    return String(serverId);
  }
  return contentFingerprint(payload);
}

// In-memory guard against concurrent poll + callback double-fire in the same process
const recentFired = new Map(); // id -> timestamp
const RECENT_MS = 120000; // 2 minutes

function recentlyFired(id) {
  if (!id) return false;
  const t = recentFired.get(id);
  if (!t) return false;
  if (Date.now() - t > RECENT_MS) {
    recentFired.delete(id);
    return false;
  }
  return true;
}

function markRecent(id) {
  if (!id) return;
  recentFired.set(id, Date.now());
  // prune
  if (recentFired.size > 50) {
    const now = Date.now();
    for (const [k, v] of recentFired) {
      if (now - v > RECENT_MS) recentFired.delete(k);
    }
  }
}

async function alreadyHandled(id) {
  if (!id) return false;
  if (recentlyFired(id)) return true;
  const raw = await getString(BRIDGE_KEYS.LAST_SIGNAL_ID, '');
  const list = raw ? raw.split('\n').filter(Boolean) : [];
  return list.includes(id);
}

async function markHandled(id) {
  if (!id) return;
  markRecent(id);
  const raw = await getString(BRIDGE_KEYS.LAST_SIGNAL_ID, '');
  const list = raw ? raw.split('\n').filter(Boolean) : [];
  const next = [id, ...list.filter((x) => x !== id)].slice(0, 40);
  await setString(BRIDGE_KEYS.LAST_SIGNAL_ID, next.join('\n'));
}

/** Normalize Entry Bot /api/alerts row or plain signal JSON into alarm data. */
function normalizePayload(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // ntfy: body is often a JSON string in `message`
  let base = { ...raw };
  if (typeof raw.message === 'string' && raw.message.trim().startsWith('{')) {
    try {
      base = { ...raw, ...JSON.parse(raw.message) };
    } catch (_) {}
  }

  // Entry Bot alert row shape
  if (base.entry_price != null || base.stop_price != null || base.signal) {
    const inner = base.signal && typeof base.signal === 'object' ? base.signal : {};
    return {
      ...inner,
      ...base,
      symbol: base.symbol || inner.symbol,
      action: base.action || inner.action,
      entry: base.entry || base.entry_price || inner.entry,
      sl: base.sl || base.stop_price || inner.sl,
      tp: base.tp || base.take_profit_price || base.tp1_price || inner.tp,
      kind: 'alarm',
      id: base.id || inner.id || base.created_at,
    };
  }

  const extracted = extractPushPayload(base) || base;
  if (!extracted.symbol && !extracted.action && extracted.kind !== 'alarm') {
    return null;
  }
  return { ...extracted, kind: extracted.kind || 'alarm' };
}

async function fireAlarm({ title, body, data }) {
  // Persist so the alarm CARD can be restored when the user later opens the app
  try {
    await setJSON(KEYS.ACTIVE_ALARM, {
      ...(data || {}),
      message: body,
      body,
      title,
      savedAt: Date.now(),
    });
  } catch (_) {}

  // NO tray notification for signals — ring only (in-app audio).
  // Monitoring FGS notification is the only permanent silent badge.

  try {
    await launchAppOverlay();
  } catch (_) {}
  setTimeout(() => {
    launchAppOverlay().catch(() => {});
  }, 600);

  // UI / audio path when React handler is registered
  if (typeof onSignalCallback === 'function') {
    try {
      await onSignalCallback({ title, body, data, skipNotification: true });
    } catch (e) {
      console.warn('[Tentry bridge] UI handler failed', e);
    }
  }
}

async function emitSignal(raw) {
  console.log('[Tentry bridge] emit raw keys', raw && Object.keys(raw));

  const data = normalizePayload(raw);
  if (!data) {
    console.warn('[Tentry bridge] could not normalize payload');
    return;
  }
  if (data.kind === 'monitoring') return;

  // Parse plain-text ntfy bodies if still no symbol
  if (!data.symbol && (raw?.message || raw?.title)) {
    const text = String(raw.message || raw.title || '');
    const m = text.match(
      /([A-Z0-9]+)\s+(LONG|SHORT|BUY|SELL)\b(?:.*?entry[:\s]+([0-9.]+))?(?:.*?sl[:\s]+([0-9.]+))?(?:.*?tp[:\s]+([0-9.]+))?/i
    );
    if (m) {
      data.symbol = data.symbol || m[1];
      data.action = data.action || m[2].toUpperCase();
      if (m[3]) data.entry = data.entry || m[3];
      if (m[4]) data.sl = data.sl || m[4];
      if (m[5]) data.tp = data.tp || m[5];
    }
    data.message = data.message || text;
    data.kind = data.kind || 'alarm';
  }

  if (!data.symbol && !data.action) {
    console.warn('[Tentry bridge] no symbol/action — skip');
    return;
  }

  const id = signalId(data, raw);
  const fp = contentFingerprint(data);

  // Dedupe by server id AND content fingerprint (same levels = same signal)
  if (await alreadyHandled(id) || (fp && (await alreadyHandled(fp)))) {
    console.log('[Tentry bridge] already handled', id, fp);
    return;
  }

  const { title, body } = buildSignalText({
    title: data.symbol ? null : raw?.title || null,
    body: null,
    data,
  });

  // Mark BEFORE fire so concurrent poll loops cannot double-fire
  await markHandled(id);
  if (fp && fp !== id) await markHandled(fp);

  console.log('[Tentry bridge] firing once', title, body, id, fp);
  await fireAlarm({ title, body, data: { ...data, _signalId: id, _fp: fp } });
}

async function pollOnce(url, signal, apiKey) {
  const headers = { Accept: 'application/json' };
  if (apiKey) {
    headers['X-Entry-Bot-Key'] = apiKey;
  }
  const res = await fetch(url, { method: 'GET', headers, signal });
  if (!res.ok) throw new Error(`poll HTTP ${res.status}`);
  const json = await res.json();

  // Entry Bot: GET /api/alerts returns an array of rows
  if (Array.isArray(json)) {
    if (json.length === 0) return;
    await emitSignal(json[0]);
    return;
  }

  const payload = json?.signal || json?.data || json?.alerts?.[0] || json;
  if (payload && (payload.symbol || payload.action || payload.kind === 'alarm' || payload.entry_price)) {
    await emitSignal(payload);
  }
}

async function ntfyLongPoll(server, topic, signal) {
  const base = (server || DEFAULT_NTFY_SERVER).replace(/\/$/, '');
  const url = `${base}/${encodeURIComponent(topic)}/json?poll=1&since=30s`;
  console.log('[Tentry bridge] ntfy poll', url);
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/x-ndjson, application/json' },
    signal,
  });
  if (!res.ok) throw new Error(`ntfy HTTP ${res.status}`);
  const text = await res.text();
  if (!text || !text.trim()) return;

  const lines = text.trim().split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.event && msg.event !== 'message') continue;
      if (!msg.message && !msg.title) continue;
      await emitSignal(msg);
    } catch (e) {
      console.warn('[Tentry bridge] ntfy line parse failed', e);
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function bridgeLoop() {
  if (running) return;
  running = true;
  console.log('[Tentry bridge] started');

  while (running) {
    const mode = (await getString(BRIDGE_KEYS.BRIDGE_ENABLED, 'off')) || 'off';
    if (mode === 'off') {
      await sleep(3000);
      continue;
    }

    bridgeAbort = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const signal = bridgeAbort?.signal;

    try {
      if (mode === 'ntfy') {
        const topic = (await getString(BRIDGE_KEYS.NTFY_TOPIC, '')).trim();
        const server = (await getString(BRIDGE_KEYS.NTFY_SERVER, DEFAULT_NTFY_SERVER)).trim();
        if (!topic) {
          console.warn('[Tentry bridge] ntfy mode but empty topic');
          await sleep(5000);
          continue;
        }
        await ntfyLongPoll(server, topic, signal);
        await sleep(400);
      } else if (mode === 'poll') {
        const url = (await getString(BRIDGE_KEYS.POLL_URL, '')).trim();
        const apiKey = (await getString(BRIDGE_KEYS.POLL_API_KEY, '')).trim();
        const interval = (await getJSON(BRIDGE_KEYS.POLL_INTERVAL_MS, DEFAULT_POLL_MS)) || DEFAULT_POLL_MS;
        if (!url) {
          console.warn('[Tentry bridge] poll mode but empty URL');
          await sleep(5000);
          continue;
        }
        await pollOnce(url, signal, apiKey);
        await sleep(Math.max(3000, interval));
      } else {
        await sleep(5000);
      }
    } catch (e) {
      if (e?.name === 'AbortError') {
        // stopped
      } else {
        console.warn('[Tentry bridge] loop error', e?.message || e);
        await sleep(5000);
      }
    }
  }

  console.log('[Tentry bridge] stopped');
}

export function startSignalBridge() {
  if (Platform.OS === 'web') return;
  if (running) return;
  bridgeLoop().catch((e) => console.warn('[Tentry bridge] fatal', e));
}

export function stopSignalBridge() {
  running = false;
  try {
    bridgeAbort?.abort();
  } catch (_) {}
  bridgeAbort = null;
}

export async function getBridgeConfig() {
  return {
    mode: (await getString(BRIDGE_KEYS.BRIDGE_ENABLED, 'off')) || 'off',
    ntfyTopic: (await getString(BRIDGE_KEYS.NTFY_TOPIC, '')) || '',
    ntfyServer: (await getString(BRIDGE_KEYS.NTFY_SERVER, DEFAULT_NTFY_SERVER)) || DEFAULT_NTFY_SERVER,
    pollUrl: (await getString(BRIDGE_KEYS.POLL_URL, '')) || '',
    pollApiKey: (await getString(BRIDGE_KEYS.POLL_API_KEY, '')) || '',
    pollIntervalMs: (await getJSON(BRIDGE_KEYS.POLL_INTERVAL_MS, DEFAULT_POLL_MS)) || DEFAULT_POLL_MS,
  };
}

export async function setBridgeConfig({ mode, ntfyTopic, ntfyServer, pollUrl, pollApiKey, pollIntervalMs }) {
  if (mode !== undefined) await setString(BRIDGE_KEYS.BRIDGE_ENABLED, mode || 'off');
  if (ntfyTopic !== undefined) await setString(BRIDGE_KEYS.NTFY_TOPIC, ntfyTopic || '');
  if (ntfyServer !== undefined) await setString(BRIDGE_KEYS.NTFY_SERVER, ntfyServer || DEFAULT_NTFY_SERVER);
  if (pollUrl !== undefined) await setString(BRIDGE_KEYS.POLL_URL, pollUrl || '');
  if (pollApiKey !== undefined) await setString(BRIDGE_KEYS.POLL_API_KEY, pollApiKey || '');
  if (pollIntervalMs !== undefined) await setJSON(BRIDGE_KEYS.POLL_INTERVAL_MS, pollIntervalMs);
  // Do NOT clear handled ids on every save — that re-fired the same alert in a loop.
  // Use Settings "Test poll" (force) to re-fire intentionally.
  stopSignalBridge();
  startSignalBridge();
}

/**
 * One-shot poll for Settings "Test" button.
 * Returns { ok, message, payload? } and fires the alarm if a new/force signal is found.
 */
export async function testPollNow({ force = true } = {}) {
  const url = (await getString(BRIDGE_KEYS.POLL_URL, '')).trim();
  const apiKey = (await getString(BRIDGE_KEYS.POLL_API_KEY, '')).trim();
  if (!url) {
    return { ok: false, message: 'No poll URL saved. Set HTTP poll URL and Save first.' };
  }
  try {
    const headers = { Accept: 'application/json' };
    if (apiKey) headers['X-Entry-Bot-Key'] = apiKey;
    const res = await fetch(url, { method: 'GET', headers });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    let json;
    try {
      json = JSON.parse(text);
    } catch (_) {
      return { ok: false, message: `Not JSON: ${text.slice(0, 120)}` };
    }
    const row = Array.isArray(json) ? json[0] : (json?.signal || json?.data || json?.alerts?.[0] || json);
    if (!row) {
      return { ok: false, message: 'Server returned empty list — no alerts yet.' };
    }
    if (force) {
      await setString(BRIDGE_KEYS.LAST_SIGNAL_ID, '');
    }
    await emitSignal(row);
    const sym = row.symbol || row?.signal?.symbol || '?';
    const act = row.action || '?';
    return { ok: true, message: `Got ${sym} ${act} (id ${row.id ?? 'n/a'}) — alarm should fire.` };
  } catch (e) {
    return { ok: false, message: String(e?.message || e) };
  }
}

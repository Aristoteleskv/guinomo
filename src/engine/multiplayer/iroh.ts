// P2P multiplayer over iroh-gossip (wasm), replacing the old WebSocket relay.
// Room seeds define the gossip topic + pkarr rendezvous key on dns.iroh.link;
// peers discover each other via periodic pkarr
// resolve. Browsers can't hole-punch, so traffic is relayed through n0's
// public relays — still e2e encrypted, no app server. Frames are signed
// (ed25519) + sequenced in Rust.
//
// State encoding (34 bytes; older 32/33-byte frames remain readable):
//   [0]      u8   version (2)
//   [1..13]  p    3 × f32 LE
//   [13..21] r    2 × f32 LE
//   [21]     u8   a (animation: 0 idle, 1 run, 2 bored)
//   [22..26] seed f32 LE
//   [26..30] uid  u32 LE
//   [30]     u8   h (hat visible)
//   [31]     u8   phy (physique index)
//   [32]     u8   age scale (percentage)
//   [33]     u8   gender category (0 unknown, 1 masculine, 2 feminine, 3 other)
//
// Chat and typing ride the same gossip channel as v3 envelopes (34-byte state
// header + msg type + UTF-8 JSON payload), so purely positional frames (v2) stay
// readable by every client. See stateCodec.ts for the exact layout.

import { SummerNode, type RoomChannel } from 'guinomo-browser';
import { encodeState, decodeEnvelope, encodeChat, encodeTyping, type P2PData, type P2PClientData, type P2PChatMessage, type P2PTyping } from './stateCodec';

export {
  encodeState,
  decodeState,
  decodeEnvelope,
  encodeChat,
  encodeTyping,
} from './stateCodec';
export type { P2PData, P2PClientData, P2PChatMessage, P2PTyping } from './stateCodec';

interface P2POptions {
  data: P2PData;
  roomSeed?: Uint8Array; // Semente da sala para isolar mundos/perfis
  updateRate?: number;
  maxClients?: number; // Máximo de remotos rastreados em simultâneo
  addClient?: (id: string, data: P2PClientData) => void;
  removeClient?: (id: string) => void;
  removeAllClients?: () => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onChat?: (chat: P2PChatMessage) => void;
  onTyping?: (typing: P2PTyping) => void;
}

const DEFAULT_ROOM_SEED = new Uint8Array(32);
DEFAULT_ROOM_SEED.set(new TextEncoder().encode('guinomo-p2p-room-v1'));
/** Remove remotes that stopped sending this long ago (they left or hid). */
const REMOTE_TIMEOUT_MS = 10_000;
/** Full-state heartbeat: newcomers can always bootstrap from us. */
const HEARTBEAT_MS = 2_000;
/** While the tab is hidden, keep presence alive at a slow rate. */
const HIDDEN_RATE_MS = 1_000;

type MessageEvent = {
  type: 'messageReceived';
  from: string;
  // serde-wasm-bindgen delivers Vec<u8> as a plain JS Array; normalize in
  // `toBytes` so both shapes are accepted.
  data: Uint8Array | number[];
  sentTimestamp: number;
};
type NeighborUpEvent = { type: 'neighborUp'; endpointId: string };
type NeighborDownEvent = { type: 'neighborDown'; endpointId: string };
type LaggedEvent = { type: 'lagged' };
type P2PEvent = MessageEvent | NeighborUpEvent | NeighborDownEvent | LaggedEvent;

const noop = () => {};

export class P2PConnection {
  _clients = new Map<string, P2PClientData>();
  _data: P2PData;
  private _lastSeen = new Map<string, number>();
  private _updateRate: number;
  private _maxClients: number;
  private _prevData = '{}';
  private _lastFullSent = 0;
  private _connected = false;
  private _node: SummerNode | null = null;
  private _channel: RoomChannel | null = null;
  private _reader: ReadableStreamDefaultReader<P2PEvent> | null = null;
  private _closed = false;

  private _relayInterval: ReturnType<typeof setInterval> | null = null;
  private _sweepInterval: ReturnType<typeof setInterval> | null = null;
  private _retryTimeout: ReturnType<typeof setTimeout> | null = null;

  private _onAddClient: (id: string, data: P2PClientData) => void;
  private _onRemoveClient: (id: string) => void;
  private _onRemoveAllClients: () => void;
  private _onConnect: () => void;
  private _onDisconnect: () => void;
  private _onChat: (chat: P2PChatMessage) => void;
  private _onTyping: (typing: P2PTyping) => void;

  constructor(options: P2POptions) {
    this._data = options.data;
    this._updateRate = options.updateRate ?? 35;
    this._maxClients = options.maxClients ?? Infinity;
    this._onAddClient = options.addClient ?? noop;
    this._onRemoveClient = options.removeClient ?? noop;
    this._onRemoveAllClients = options.removeAllClients ?? noop;
    this._onConnect = options.onConnect ?? noop;
    this._onDisconnect = options.onDisconnect ?? noop;
    this._onChat = options.onChat ?? noop;
    this._onTyping = options.onTyping ?? noop;
    this._onRemoveAllClients();
    void this._init(options.roomSeed);
  }

  /** Spawns the iroh node and joins its world room; retries until it succeeds. */
  private async _init(roomSeed?: Uint8Array) {
    try {
      const node = await SummerNode.spawn();
      this._node = node;
      const channel = await node.join_room(roomSeed ?? DEFAULT_ROOM_SEED);
      if (this._closed) return;
      this._channel = channel;
      this._reader = channel.receiver.getReader() as ReadableStreamDefaultReader<P2PEvent>;

      this._connected = true;
      this._onConnect();
      this._relay(true);
      void this._readLoop();
      this._relayInterval = setInterval(() => this._relay(), this._updateRate);
      this._sweepInterval = setInterval(() => this._sweep(), 1000);
      console.info(`[p2p] joined room as ${node.endpoint_id()}`);
    } catch (err) {
      console.warn('[p2p] join failed, retrying in 5s', err);
      this._teardown();
      if (!this._closed) {
        this._retryTimeout = setTimeout(() => void this._init(roomSeed), 5000);
      }
    }
  }

  /** Consumes the event stream and applies remote state. */
  private async _readLoop() {
    const reader = this._reader;
    if (!reader) return;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        this._onEvent(value);
      }
    } catch (err) {
      if (!this._closed) console.warn('[p2p] event stream closed', err);
    }
  }

  private _onEvent(event: P2PEvent) {
    switch (event.type) {
      case 'messageReceived': {
        const from = event.from;
        if (from === this._node?.endpoint_id()) return; // never echo ourselves
        let envelope;
        try {
          envelope = decodeEnvelope(toBytes(event.data));
        } catch (err) {
          console.warn('[p2p] undecodable frame', err);
          return;
        }
        const state: P2PClientData = envelope.state;
        this._lastSeen.set(from, Date.now());
        const existing = this._clients.get(from);
        if (existing) {
          for (const key of Object.keys(state)) {
            if (Array.isArray(state[key]) && state[key].length === 0) continue;
            existing[key] = state[key];
          }
        } else if (this._clients.size < this._maxClients) {
          this._clients.set(from, { ...this._data, ...state });
          this._onAddClient(from, { ...this._data, ...state });
        }
        if (envelope.chat) {
          this._onChat({ from, uid: envelope.chat.uid, name: envelope.chat.name, text: envelope.chat.text });
        }
        if (envelope.typing) {
          this._onTyping({ from, uid: envelope.typing.uid, name: envelope.typing.name });
        }
        return;
      }
      case 'neighborDown': {
        const id = event.endpointId;
        if (!this._clients.has(id)) return;
        this._clients.delete(id);
        this._lastSeen.delete(id);
        this._onRemoveClient(id);
        return;
      }
      case 'neighborUp':
      case 'lagged':
        return;
    }
  }

  /** Publishes local state: full state on join, on change, or as heartbeat. */
  private _relay(force = false) {
    if (!this._connected || !this._channel) return;
    const now = Date.now();
    const hidden = document.hidden;
    const heartbeatElapsed = now - this._lastFullSent >= (hidden ? HIDDEN_RATE_MS : HEARTBEAT_MS);
    if (force || heartbeatElapsed) {
      this._prevData = JSON.stringify(this._data);
      this._lastFullSent = now;
      this._send(this._data);
      return;
    }
    const changed = this._retrieveChangedData();
    if (Object.keys(changed).length > 0) {
      this._prevData = JSON.stringify(this._data);
      this._lastFullSent = now;
      this._send(this._data);
    }
  }

  private _retrieveChangedData(): P2PData {
    const prev = JSON.parse(this._prevData) as P2PData;
    const changed: P2PData = {};
    for (const key of Object.keys(this._data)) {
      if (JSON.stringify(prev[key]) !== JSON.stringify(this._data[key])) {
        changed[key] = this._data[key];
      }
    }
    return changed;
  }

  private _send(data: P2PData) {
    const payload = encodeState(data);
    void this._channel!.sender.broadcast(payload);
  }

  /** Broadcasts a chat message to the world room. Returns false while offline. */
  sendChat(name: string, text: string): boolean {
    if (!this._connected || !this._channel) return false;
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!clean) return false;
    const payload = encodeChat((this._data.uid as number) ?? 0, name.slice(0, 40), clean);
    void this._channel!.sender.broadcast(payload);
    return true;
  }

  /** Broadcasts a "typing" signal to the world room (peers auto-expire it). */
  sendTyping(name: string): void {
    if (!this._connected || !this._channel) return;
    const payload = encodeTyping((this._data.uid as number) ?? 0, name.slice(0, 40));
    void this._channel!.sender.broadcast(payload);
  }

  /** Drops remotes that stopped sending (they left or went idle-hidden). */
  private _sweep() {
    const now = Date.now();
    for (const [id, lastSeen] of this._lastSeen) {
      if (now - lastSeen > REMOTE_TIMEOUT_MS) {
        this._lastSeen.delete(id);
        if (this._clients.has(id)) {
          this._clients.delete(id);
          this._onRemoveClient(id);
        }
      }
    }
  }

  private _teardown() {
    if (this._relayInterval) clearInterval(this._relayInterval);
    if (this._sweepInterval) clearInterval(this._sweepInterval);
    this._relayInterval = null;
    this._sweepInterval = null;
    if (this._connected) {
      this._connected = false;
      this._onDisconnect();
    }
    this._reader?.cancel().catch(() => {});
    this._channel?.close();
    this._reader = null;
    this._channel = null;
  }

  _dispose() {
    this._closed = true;
    if (this._retryTimeout) clearTimeout(this._retryTimeout);
    this._teardown();
  }
}

// ---------------------------------------------------------------------------
// Event payload helpers
// ---------------------------------------------------------------------------

/** Normalizes the event payload (plain Array from serde-wasm-bindgen) to bytes. */
function toBytes(data: Uint8Array | number[]): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

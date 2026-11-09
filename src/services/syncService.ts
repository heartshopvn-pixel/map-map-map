import { SyncPacket } from '../types/game';

export type WsConnectionStatus = 'simulated' | 'connecting' | 'connected' | 'error';

type SyncListener = (packet: SyncPacket) => void;
type TikTokEventListener = (event: {
  type: 'chat' | 'gift' | 'like' | 'follow' | 'member';
  username: string;
  avatarUrl?: string | null;
  profilePictureUrl?: string | null;
  comment?: string;
  giftName?: string;
  coins?: number;
  repeatCount?: number;
  comboCount?: number;
  likeCount?: number;
}) => void;
type StatusListener = (status: WsConnectionStatus) => void;
type PeerCountListener = (counts: { totalPeers: number; obsPeers: number }) => void;

class LiveSyncService {
  private clientId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  private channel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;
  private ws: WebSocket | null = null;
  private syncListeners = new Set<SyncListener>();
  private tiktokListeners = new Set<TikTokEventListener>();
  private statusListeners = new Set<StatusListener>();
  private peerListeners = new Set<PeerCountListener>();
  private status: WsConnectionStatus = 'simulated';
  private recentPacketTimestamps = new Set<number>();

  private isObsView(): boolean {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('obs') === '1' ||
      params.get('view') === 'live' ||
      params.get('mode') === 'live'
    );
  }

  constructor() {
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('chua_online_live_sync_v1');
      this.channel.onmessage = (ev) => {
        if (ev.data?.type === 'ADMIN_SYNC') {
          this.dispatchIncomingSync(ev.data as SyncPacket);
        }
      };
    }
    this.initServerRelay();
    if (typeof window !== 'undefined') {
      if (this.isObsView()) {
        setTimeout(() => {
          this.sendCommand('REQUEST_FULL_SYNC', {});
        }, 180);
      }
      setTimeout(() => {
        if (this.status === 'simulated' && !this.ws) {
          this.connectWebSocket('ws://localhost:8080');
        }
      }, 500);
    }
  }

  private isStaticHost(): boolean {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    return host.endsWith('github.io') || host.endsWith('pages.dev') || host.endsWith('vercel.app') || host.endsWith('netlify.app');
  }

  private reconnectEsTimer: ReturnType<typeof setTimeout> | null = null;
  private lastWsUrl: string = '';
  private shouldReconnectWs: boolean = false;
  private reconnectWsTimer: ReturnType<typeof setTimeout> | null = null;
  private localSseFallback: EventSource | null = null;
  private recentTikTokEventKeys = new Map<string, number>();
  private tiktokLogs: string[] = [];
  private tiktokLogListeners = new Set<(logs: string[]) => void>();
  private roomInfoListeners = new Set<
    (info: { username: string; roomId: string; message: string }) => void
  >();
  private lastRoomInfo = { username: '', roomId: '', message: '' };

  private appendTikTokLog(line: string) {
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    this.tiktokLogs = [`[${timeStr}] ${line}`, ...this.tiktokLogs].slice(0, 80);
    this.tiktokLogListeners.forEach((fn) => fn(this.tiktokLogs));
  }

  public getTikTokLogs(): string[] {
    return this.tiktokLogs;
  }

  public onTikTokLog(fn: (logs: string[]) => void) {
    this.tiktokLogListeners.add(fn);
    return () => this.tiktokLogListeners.delete(fn);
  }

  public getRoomInfo() {
    return this.lastRoomInfo;
  }

  public onRoomInfoChange(
    fn: (info: { username: string; roomId: string; message: string }) => void
  ) {
    this.roomInfoListeners.add(fn);
    return () => this.roomInfoListeners.delete(fn);
  }

  private emitDeduplicatedTikTokEvent(ev: {
    type: 'chat' | 'gift' | 'like' | 'follow' | 'member';
    username: string;
    avatarUrl?: string | null;
    profilePictureUrl?: string | null;
    comment?: string;
    giftName?: string;
    coins?: number;
    repeatCount?: number;
    comboCount?: number;
    likeCount?: number;
  }) {
    const now = Date.now();
    for (const [k, t] of this.recentTikTokEventKeys.entries()) {
      if (now - t > 450) this.recentTikTokEventKeys.delete(k);
    }
    const dedupKey = `${ev.type}:${ev.username}:${ev.comment || ev.giftName || ev.likeCount || ''}`;
    const prevAt = this.recentTikTokEventKeys.get(dedupKey);
    if (prevAt && now - prevAt < 350) {
      return;
    }
    this.recentTikTokEventKeys.set(dedupKey, now);

    if (ev.type === 'chat') {
      this.appendTikTokLog(`💬 [CHAT] ${ev.username}: ${ev.comment}`);
    } else if (ev.type === 'gift') {
      this.appendTikTokLog(
        `🎁 [GIFT] ${ev.username} tặng ${ev.giftName} (${ev.coins || 1} xu)`
      );
    } else if (ev.type === 'like') {
      this.appendTikTokLog(`❤️ [LIKE] ${ev.username} thả ${ev.likeCount || 1} tim`);
    } else if (ev.type === 'follow') {
      this.appendTikTokLog(`➕ [FOLLOW] ${ev.username} đã follow kênh`);
    } else if (ev.type === 'member') {
      this.appendTikTokLog(`👋 [VÀO PHÒNG] ${ev.username} đã vào phòng Live`);
    }

    this.tiktokListeners.forEach((fn) => fn(ev));
  }

  private initServerRelay() {
    if (typeof window === 'undefined' || !('EventSource' in window) || this.isStaticHost()) return;
    const params = new URLSearchParams(window.location.search);
    const isObs =
      params.get('obs') === '1' ||
      params.get('view') === 'live' ||
      params.get('mode') === 'live';
    const role = isObs ? 'obs' : 'admin';

    try {
      if (this.eventSource) {
        this.eventSource.close();
      }
      const es = new EventSource(
        `/api/sync-stream?clientId=${encodeURIComponent(this.clientId)}&role=${role}`
      );
      this.eventSource = es;

      es.onopen = () => {
        if (isObs) {
          this.sendCommand('REQUEST_FULL_SYNC', {});
        }
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'PEER_STATUS') {
            this.peerListeners.forEach((fn) =>
              fn({ totalPeers: data.totalPeers || 1, obsPeers: data.obsPeers || 0 })
            );
          } else if (data.type === 'ADMIN_SYNC') {
            this.dispatchIncomingSync(data as SyncPacket);
          } else if (data.type === 'TIKTOK_LIVE_STATUS') {
            if (data.status === 'connected') {
              this.setStatus('connected');
            } else if (data.status === 'connecting') {
              this.setStatus('connecting');
            } else if (data.status === 'error') {
              this.setStatus('error');
            }
            this.lastRoomInfo = {
              username: data.username || this.lastRoomInfo.username,
              roomId: data.roomId || '',
              message: data.message || '',
            };
            this.roomInfoListeners.forEach((fn) => fn(this.lastRoomInfo));
            if (data.message) {
              this.appendTikTokLog(`📡 ${data.message}`);
            }
          } else if (data.type === 'TIKTOK_LIVE_EVENT' && data.event) {
            if (this.status !== 'connected') {
              this.setStatus('connected');
            }
            this.handleRawTikTokPayload(data.event);
          }
        } catch {
          // Ignore malformed event
        }
      };

      es.onerror = () => {
        es.close();
        if (this.reconnectEsTimer) clearTimeout(this.reconnectEsTimer);
        this.reconnectEsTimer = setTimeout(() => {
          this.initServerRelay();
        }, 3000);
      };
    } catch {
      // Ignore SSE error if offline
    }
  }

  private dispatchIncomingSync(packet: SyncPacket) {
    // Deduplicate packets received via both BroadcastChannel and Server SSE Relay
    if (packet.ts && this.recentPacketTimestamps.has(packet.ts)) {
      return;
    }
    if (packet.ts) {
      this.recentPacketTimestamps.add(packet.ts);
      if (this.recentPacketTimestamps.size > 100) {
        const first = this.recentPacketTimestamps.values().next().value;
        if (first !== undefined) this.recentPacketTimestamps.delete(first);
      }
    }
    this.syncListeners.forEach((fn) => fn(packet));
  }

  public onSync(fn: SyncListener) {
    this.syncListeners.add(fn);
    return () => this.syncListeners.delete(fn);
  }

  public onTikTokEvent(fn: TikTokEventListener) {
    this.tiktokListeners.add(fn);
    return () => this.tiktokListeners.delete(fn);
  }

  public onStatusChange(fn: StatusListener) {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  public onPeerCountChange(fn: PeerCountListener) {
    this.peerListeners.add(fn);
    return () => this.peerListeners.delete(fn);
  }

  private setStatus(next: WsConnectionStatus) {
    this.status = next;
    this.statusListeners.forEach((fn) => fn(next));
  }

  public getStatus(): WsConnectionStatus {
    return this.status;
  }

  private stripHeavyDataUrls(obj: any): any {
    if (typeof obj === 'string') {
      // Cho phép đồng bộ đầy đủ cả file nhạc MP3 (data:audio/...) và ảnh nhân vật (data:image/...) lên tới 45MB sang màn hình Live
      return obj.startsWith('data:audio/') && obj.length > 45 * 1024 * 1024 ? null : obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.stripHeavyDataUrls(item));
    }
    if (obj && typeof obj === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        out[k] = this.stripHeavyDataUrls(v);
      }
      return out;
    }
    return obj;
  }

  private debouncedRelayTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private pendingMergedPayloads = new Map<string, Record<string, any>>();

  private dispatchNetworkRelay(packet: SyncPacket) {
    let serializedPacket = JSON.stringify(packet);
    if (serializedPacket.length > 45 * 1024 * 1024) {
      serializedPacket = JSON.stringify(this.stripHeavyDataUrls(packet));
    }

    // 2. Cloud/Server Relay to OBS Browser Source or separate browser windows
    if (!this.isStaticHost()) {
      const bodyStr = JSON.stringify({
        senderId: this.clientId,
        packet: JSON.parse(serializedPacket),
      });

      fetch('/api/sync-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
      }).catch(() => {
        // Ignore if static host
      });
    }

    // 3. Local Node.js WebSocket bridge (ws://localhost:8080) for cross-browser Chrome <-> TikTok Live Studio
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(serializedPacket);
      } catch {
        // Ignore
      }
    }
  }

  public sendCommand(action: SyncPacket['action'], payload: Record<string, any> = {}) {
    const packet: SyncPacket = {
      type: 'ADMIN_SYNC',
      action,
      payload,
      ts: Date.now() + Math.random(),
    };
    this.recentPacketTimestamps.add(packet.ts);

    // 1. Instant local same-browser BroadcastChannel (0ms latency within same browser)
    try {
      this.channel?.postMessage(packet);
    } catch {
      // Ignore
    }

    // Debounce & merge high-frequency slider/drag commands (70ms) over HTTP/WS so dragging sliders in Chrome never floods /api/sync-command or blocks /api/tts
    const isHighFreqConfigPatch = action === 'UPDATE_CONFIG';

    if (isHighFreqConfigPatch) {
      const prevPending = this.pendingMergedPayloads.get(action) || {};
      const mergedPayload: Record<string, any> = {
        ...prevPending,
        ...payload,
      };
      if (prevPending.patch && payload.patch) {
        mergedPayload.patch = { ...prevPending.patch, ...payload.patch };
      }
      if (prevPending.grid && payload.grid) {
        mergedPayload.grid = { ...prevPending.grid, ...payload.grid };
      }
      this.pendingMergedPayloads.set(action, mergedPayload);

      const existingTimer = this.debouncedRelayTimers.get(action);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      const timer = setTimeout(() => {
        this.debouncedRelayTimers.delete(action);
        const finalPayload = this.pendingMergedPayloads.get(action) || payload;
        this.pendingMergedPayloads.delete(action);
        const mergedPacket: SyncPacket = {
          type: 'ADMIN_SYNC',
          action,
          payload: finalPayload,
          ts: Date.now() + Math.random(),
        };
        this.recentPacketTimestamps.add(mergedPacket.ts);
        this.dispatchNetworkRelay(mergedPacket);
      }, 70);
      this.debouncedRelayTimers.set(action, timer);
      return;
    }

    this.dispatchNetworkRelay(packet);
  }

  public async connectTikTokRoom(username: string): Promise<{ ok: boolean; error?: string; roomId?: string }> {
    const clean = username.trim().replace(/^@+/, '');
    if (!clean) return { ok: false, error: 'Vui lòng nhập ID TikTok' };

    // Đảm bảo kết nối WebSocket tới Local Bridge 8080 nếu chưa mở
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectWebSocket(this.lastWsUrl || 'ws://127.0.0.1:8080');
    } else {
      try {
        this.ws.send(JSON.stringify({ type: 'CONNECT_TIKTOK', username: clean }));
      } catch {
        // Ignore
      }
    }

    // 1. Ưu tiên gọi trực tiếp Local Node.js Bridge (http://127.0.0.1:8080/connect) - hoạt động cả trên GitHub Pages lẫn Local
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const localRes = await fetch('http://127.0.0.1:8080/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: clean }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const localData = await localRes.json();
      if (localRes.ok && localData?.ok) {
        this.setStatus('connected');
        return { ok: true, roomId: localData.roomId || 'Local-8080' };
      }
      if (localData?.error && this.isStaticHost()) {
        return { ok: false, error: localData.error };
      }
    } catch {
      // Nếu Local Bridge 8080 chưa bật hoặc đang chạy trên Cloud Server
    }

    // Nếu đang mở trên GitHub Pages mà ws://localhost:8080 đã kết nối (bản server.js cũ chưa có /connect)
    if (this.isStaticHost()) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.setStatus('connected');
        return { ok: true, roomId: 'WS-8080' };
      }
      return {
        ok: false,
        error: 'Chưa kết nối được server.js ở máy! Hãy mở CMD chạy: node server.js',
      };
    }

    // 2. Kết nối qua Backend Server tích hợp sẵn (khi chạy trên AI Studio / Node server)
    try {
      const res = await fetch('/api/tiktok/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: clean }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || 'Không thể kết nối phòng Live' };
      }
      this.setStatus('connected');
      return { ok: true, roomId: data.roomId };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Lỗi mạng khi gọi máy chủ' };
    }
  }

  public async disconnectTikTokRoom() {
    try {
      fetch('http://127.0.0.1:8080/disconnect', { method: 'POST' }).catch(() => {});
    } catch {
      // Ignore
    }
    if (!this.isStaticHost()) {
      try {
        await fetch('/api/tiktok/disconnect', { method: 'POST' });
      } catch {
        // Ignore
      }
    }
    this.disconnectWebSocket();
  }

  public disconnectWebSocket() {
    this.shouldReconnectWs = false;
    if (this.reconnectWsTimer) {
      clearTimeout(this.reconnectWsTimer);
      this.reconnectWsTimer = null;
    }
    if (this.localSseFallback) {
      try {
        this.localSseFallback.close();
      } catch {
        // Ignore
      }
      this.localSseFallback = null;
    }
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
    this.setStatus('simulated');
  }

  private extractAvatar(obj: any): string | null {
    if (!obj || typeof obj !== 'object') return null;
    const u = obj.user || obj.userDetails || obj;
    const candidates = [
      obj.avatarUrl,
      obj.profilePictureUrl,
      u?.avatarUrl,
      u?.profilePictureUrl,
      u?.avatarLarge?.url?.[0],
      u?.avatarLarge?.urls?.[0],
      u?.avatarLarge?.urlList?.[0],
      u?.profilePicture?.url?.[0],
      u?.profilePicture?.urls?.[0],
      u?.profilePicture?.urlList?.[0],
      u?.avatarThumb?.url?.[0],
      u?.avatarThumb?.urls?.[0],
      u?.avatarThumb?.urlList?.[0],
      u?.avatarMedium?.url?.[0],
      u?.avatarMedium?.urls?.[0],
      obj.profilePicture?.url?.[0],
      obj.profilePicture?.urls?.[0],
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.startsWith('http')) return c;
    }
    const boxes = [u?.profilePicture, u?.avatarThumb, u?.avatarLarge, obj.profilePicture];
    for (const box of boxes) {
      if (box && typeof box === 'object') {
        for (const val of Object.values(box)) {
          if (typeof val === 'string' && val.startsWith('http')) return val;
          if (Array.isArray(val)) {
            const found = val.find(
              (item) => typeof item === 'string' && item.startsWith('http')
            );
            if (found) return found;
          }
        }
      }
    }
    return null;
  }

  private extractUsername(obj: any): string {
    if (!obj || typeof obj !== 'object') return 'Học Sinh';
    const d = obj.data || obj.raw || obj;
    const u = obj.user || obj.userDetails || d?.user || d?.userDetails || d;
    const candidates = [
      obj.username && obj.username !== 'Phật Tử' ? obj.username : null,
      obj.nickname,
      obj.displayId,
      obj.uniqueId,
      u?.nickname,
      u?.displayId,
      u?.uniqueId,
      u?.username,
      d?.nickname,
      d?.displayId,
      d?.uniqueId,
      obj.username,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return 'Học Sinh';
  }

  private extractComment(obj: any): string {
    if (!obj || typeof obj !== 'object') return '';
    const d = obj.data || obj.raw || obj;
    const candidates = [
      obj.comment,
      obj.content,
      obj.text,
      obj.message,
      obj.prayer,
      d?.comment,
      d?.content,
      d?.text,
      d?.message,
      d?.common?.displayText?.defaultPattern,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return '';
  }

  private handleRawTikTokPayload(raw: any) {
    if (!raw || typeof raw !== 'object') return;
    if (raw.type === 'ADMIN_SYNC') {
      this.dispatchIncomingSync(raw as SyncPacket);
      return;
    }
    if (raw.type === 'status') {
      if (raw.status === 'connected') {
        this.setStatus('connected');
      } else if (raw.status === 'connecting') {
        this.setStatus('connecting');
      } else if (raw.status === 'error') {
        this.setStatus('error');
      }
      this.lastRoomInfo = {
        username: raw.username || this.lastRoomInfo.username,
        roomId: raw.roomId || '',
        message: raw.message || '',
      };
      this.roomInfoListeners.forEach((fn) => fn(this.lastRoomInfo));
      if (raw.message) this.appendTikTokLog(`📡 ${raw.message}`);
      return;
    }

    // Format 1: Custom Node.js server.js bridge ({ type: 'chat' | 'gift' | 'like' | 'follow' | 'member', ... })
    if (
      raw.type === 'chat' ||
      raw.type === 'comment' ||
      raw.type === 'gift' ||
      raw.type === 'like' ||
      raw.type === 'follow' ||
      raw.type === 'member'
    ) {
      const normalizedType = raw.type === 'comment' ? 'chat' : raw.type;
      const normalized = {
        ...raw,
        type: normalizedType,
        username: this.extractUsername(raw),
        avatarUrl: this.extractAvatar(raw) || this.extractAvatar(raw.raw),
        comment: this.extractComment(raw),
        giftName:
          raw.giftName ||
          raw.giftDetails?.giftName ||
          raw.gift?.name ||
          raw.extendedGiftInfo?.name ||
          raw.raw?.giftName ||
          'Quà tặng',
        likeCount: Math.max(
          1,
          Number(raw.likeCount ?? raw.count ?? raw.unmergedLikeCount ?? 1)
        ),
      };
      this.emitDeduplicatedTikTokEvent(normalized);
      return;
    }

    // Format 2: Direct TikFinity WebSocket (ws://localhost:21213) ({ event: 'chat' | 'gift' | 'like' | 'follow' | 'member', data: {...} })
    const rawEv = raw.event === 'comment' ? 'chat' : raw.event;
    const d = raw.data || {};
    if (
      rawEv === 'chat' ||
      rawEv === 'gift' ||
      rawEv === 'like' ||
      rawEv === 'follow' ||
      rawEv === 'member'
    ) {
      if (rawEv === 'gift' && d.giftType === 1 && d.repeatEnd === false) {
        return;
      }
      const username = this.extractUsername(raw);
      const avatarUrl = this.extractAvatar(d) || this.extractAvatar(raw);
      const diamondCount =
        d.diamondCount ??
        d.giftDetails?.diamondCount ??
        d.gift?.diamondCount ??
        1;
      const repeatCount = d.repeatCount ?? d.comboCount ?? 1;

      this.emitDeduplicatedTikTokEvent({
        type: rawEv,
        username,
        avatarUrl,
        comment: this.extractComment(raw),
        giftName:
          d.giftName ||
          d.giftDetails?.giftName ||
          d.gift?.name ||
          d.extendedGiftInfo?.name ||
          'Quà tặng',
        coins: Math.max(1, Number(diamondCount) * Number(repeatCount)),
        likeCount: Math.max(
          1,
          Number(d.likeCount ?? d.count ?? d.unmergedLikeCount ?? 1)
        ),
      });
    }
  }

  private startLocalHttpSseFallback(wsUrl: string) {
    if (typeof window === 'undefined' || !('EventSource' in window)) return;
    if (!wsUrl.includes('8080')) return;
    try {
      if (this.localSseFallback) {
        this.localSseFallback.close();
      }
      const sse = new EventSource('http://127.0.0.1:8080/events');
      this.localSseFallback = sse;
      sse.onopen = () => {
        this.setStatus('connected');
        this.appendTikTokLog('🔌 Đã kết nối Local Bridge qua HTTP Stream (127.0.0.1:8080)');
      };
      sse.onmessage = (ev) => {
        try {
          const raw = JSON.parse(ev.data);
          this.handleRawTikTokPayload(raw);
        } catch {
          // Ignore
        }
      };
      sse.onerror = () => {
        sse.close();
      };
    } catch {
      // Ignore
    }
  }

  public connectWebSocket(url: string, triedIpv4Fallback = false) {
    if (!url.trim()) return;
    this.lastWsUrl = url.trim();
    this.shouldReconnectWs = true;
    if (this.reconnectWsTimer) {
      clearTimeout(this.reconnectWsTimer);
      this.reconnectWsTimer = null;
    }
    try {
      if (this.ws) {
        this.ws.onclose = null;
        this.ws.close();
      }
      this.setStatus('connecting');
      const socket = new WebSocket(this.lastWsUrl);
      this.ws = socket;

      socket.onopen = () => {
        this.setStatus('connected');
        this.appendTikTokLog(`🔌 Đã kết nối WebSocket: ${this.lastWsUrl}`);
        // Khi kết nối WebSocket thành công, nếu đây là màn hình Live (?obs=1) thì lập tức xin đồng bộ toàn bộ vị trí bảng & cấu hình từ Chrome
        if (this.isObsView()) {
          setTimeout(() => {
            this.sendCommand('REQUEST_FULL_SYNC', {});
          }, 120);
        }
      };

      socket.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          this.handleRawTikTokPayload(raw);
        } catch {
          // Ignore malformed JSON
        }
      };

      socket.onclose = () => {
        // Nếu ws://localhost:8080 bị chặn bởi IPv6 hoặc trình duyệt, tự động thử sang ws://127.0.0.1:8080 và HTTP SSE fallback
        if (!triedIpv4Fallback && this.lastWsUrl.includes('localhost')) {
          const ipv4Url = this.lastWsUrl.replace('localhost', '127.0.0.1');
          this.connectWebSocket(ipv4Url, true);
          return;
        }
        this.startLocalHttpSseFallback(this.lastWsUrl);
        if (this.status !== 'connected') {
          this.setStatus('simulated');
        }
        if (this.shouldReconnectWs && this.lastWsUrl) {
          if (this.reconnectWsTimer) clearTimeout(this.reconnectWsTimer);
          this.reconnectWsTimer = setTimeout(() => {
            this.connectWebSocket(this.lastWsUrl, true);
          }, 5000);
        }
      };

      socket.onerror = () => {
        if (!triedIpv4Fallback && this.lastWsUrl.includes('localhost')) {
          return;
        }
        this.startLocalHttpSseFallback(this.lastWsUrl);
      };
    } catch {
      this.startLocalHttpSseFallback(this.lastWsUrl);
      this.setStatus('error');
    }
  }
}

export const syncService = new LiveSyncService();

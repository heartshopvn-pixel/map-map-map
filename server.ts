import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on('uncaughtException', (err) => {
  console.error('⚠️ [UNCAUGHT EXCEPTION]:', err?.message || err);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('⚠️ [UNHANDLED REJECTION]:', reason?.message || reason);
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  app.use((err: any, _req: Request, res: Response, next: express.NextFunction) => {
    if (err && (err.type === 'entity.too.large' || err.status === 413)) {
      res.status(413).json({ ok: false, error: 'Payload too large' });
      return;
    }
    next(err);
  });

  // Connected SSE clients (Admin Tabs + OBS Browser Source Windows)
  const clients = new Set<{ id: string; role: string; res: Response }>();

  const broadcastPeerCount = () => {
    const obsCount = Array.from(clients).filter((c) => c.role === 'obs').length;
    const totalCount = clients.size;
    const msg = `data: ${JSON.stringify({
      type: 'PEER_STATUS',
      totalPeers: totalCount,
      obsPeers: obsCount,
    })}\n\n`;
    clients.forEach((c) => {
      try {
        c.res.write(msg);
      } catch {
        // Ignore write error
      }
    });
  };

  // Real-time SSE Stream for syncing Admin Tab -> OBS Browser Source (?obs=1)
  app.get('/api/sync-stream', (req: Request, res: Response) => {
    const clientId = String(req.query.clientId || Math.random());
    const role = String(req.query.role || 'admin');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const clientObj = { id: clientId, role, res };
    clients.add(clientObj);
    broadcastPeerCount();

    const keepAlive = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        // Ignore
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      clients.delete(clientObj);
      broadcastPeerCount();
    });
  });

  // Receive command from Admin Tab and broadcast to all OBS / Live screens
  app.post('/api/sync-command', (req: Request, res: Response) => {
    const { senderId, packet } = req.body || {};
    if (!packet) {
      res.status(400).json({ ok: false });
      return;
    }

    const payloadStr = `data: ${JSON.stringify(packet)}\n\n`;
    clients.forEach((c) => {
      if (c.id !== senderId) {
        try {
          c.res.write(payloadStr);
        } catch {
          // Ignore
        }
      }
    });

    res.json({ ok: true, deliveredTo: Math.max(0, clients.size - 1) });
  });

  // CORS middleware for local Node server.js -> Cloud Webhook relay
  app.use('/api/tiktok-webhook', (req: Request, res: Response, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  const broadcastSSE = (payload: Record<string, any>) => {
    const msg = `data: ${JSON.stringify(payload)}\n\n`;
    clients.forEach((c) => {
      try {
        c.res.write(msg);
      } catch {
        // Ignore write error
      }
    });
  };

  // Receive TikTok Live events forwarded from user's local server.js (bypasses browser HTTPS -> ws://localhost Mixed Content blocks)
  app.post('/api/tiktok-webhook', (req: Request, res: Response) => {
    const body = req.body || {};
    if (body.type === 'status') {
      broadcastSSE({
        type: 'TIKTOK_LIVE_STATUS',
        status: body.status || 'connected',
        username: body.username || '',
        roomId: body.roomId || '',
        message: body.message || '',
      });
      res.json({ ok: true });
      return;
    }
    if (
      body.type === 'chat' ||
      body.type === 'comment' ||
      body.type === 'gift' ||
      body.type === 'like' ||
      body.type === 'follow'
    ) {
      broadcastSSE({
        type: 'TIKTOK_LIVE_EVENT',
        event: {
          ...body,
          type: body.type === 'comment' ? 'chat' : body.type,
        },
      });
    }
    res.json({ ok: true });
  });

  // Built-in Backend TikTok Live Connector (allows connecting directly by @username from Web UI)
  let activeTikTokConn: any = null;
  let activeTikTokUsername = '';
  let activeTikTokStatus: 'idle' | 'connecting' | 'connected' | 'error' = 'idle';
  let activeTikTokRoomId = '';

  const extractTikTokUsername = (data: any): string => {
    const u = data?.user || data?.userDetails || data || {};
    return (
      u.nickname ||
      u.displayId ||
      u.uniqueId ||
      data?.nickname ||
      data?.displayId ||
      data?.uniqueId ||
      'Học Sinh'
    );
  };

  const extractTikTokAvatar = (data: any): string | null => {
    const u = data?.user || data?.userDetails || data || {};
    const candidates = [
      u.profilePictureUrl,
      u.avatarUrl,
      u.avatarLarge?.url?.[0],
      u.avatarLarge?. urls?.[0],
      u.avatarLarge?.urlList?.[0],
      u.avatarThumb?.url?.[0],
      u.avatarThumb?.urls?.[0],
      u.avatarThumb?.urlList?.[0],
      u.profilePicture?.url?.[0],
      u.profilePicture?.urls?.[0],
      u.profilePicture?.urlList?.[0],
      data?.profilePictureUrl,
      data?.avatarUrl,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.startsWith('http')) return c;
    }
    return null;
  };

  const extractTikTokComment = (data: any): string => {
    return String(
      data?.comment ||
        data?.content ||
        data?.text ||
        data?.message ||
        data?.common?.displayText?.defaultPattern ||
        ''
    ).trim();
  };

  app.get('/api/tiktok/status', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      status: activeTikTokStatus,
      username: activeTikTokUsername,
      roomId: activeTikTokRoomId,
    });
  });

  app.post('/api/tiktok/disconnect', async (_req: Request, res: Response) => {
    if (activeTikTokConn) {
      try {
        activeTikTokConn.removeAllListeners?.();
        await activeTikTokConn.disconnect?.();
      } catch {
        // Ignore
      }
      activeTikTokConn = null;
    }
    activeTikTokStatus = 'idle';
    activeTikTokRoomId = '';
    broadcastSSE({
      type: 'TIKTOK_LIVE_STATUS',
      status: 'simulated',
      username: activeTikTokUsername,
      message: 'Đã ngắt kết nối phiên Live',
    });
    res.json({ ok: true });
  });

  app.post('/api/tiktok/connect', async (req: Request, res: Response) => {
    const rawUser = String(req.body?.username || '')
      .trim()
      .replace(/^@+/, '');
    if (!rawUser) {
      res.status(400).json({ ok: false, error: 'Vui lòng nhập ID TikTok' });
      return;
    }

    if (activeTikTokConn) {
      try {
        activeTikTokConn.removeAllListeners?.();
        await activeTikTokConn.disconnect?.();
      } catch {
        // Ignore
      }
      activeTikTokConn = null;
    }

    activeTikTokUsername = rawUser;
    activeTikTokStatus = 'connecting';
    broadcastSSE({
      type: 'TIKTOK_LIVE_STATUS',
      status: 'connecting',
      username: rawUser,
      message: `Đang kết nối tới phòng Live @${rawUser}...`,
    });

    try {
      const tiktokPkg: any = await import('tiktok-live-connector');
      if (tiktokPkg.RoomIdRouteConfig) {
        tiktokPkg.RoomIdRouteConfig.skipFetchRoomInfoFromHtmlRoute = true;
      } else if (tiktokPkg.default?.RoomIdRouteConfig) {
        tiktokPkg.default.RoomIdRouteConfig.skipFetchRoomInfoFromHtmlRoute = true;
      }

      const ConnectorClass =
        tiktokPkg.TikTokLiveConnection ||
        tiktokPkg.default?.TikTokLiveConnection ||
        tiktokPkg.WebcastPushConnection ||
        tiktokPkg.default?.WebcastPushConnection;

      const conn = new ConnectorClass(rawUser, {
        processInitialData: false,
        enableExtendedGiftInfo: false,
        fetchRoomInfoOnConnect: false,
      });
      if (typeof conn.fetchAvailableGifts === 'function') {
        conn.fetchAvailableGifts = async () => [];
      }
      activeTikTokConn = conn;

      const GIFT_ID_FALLBACK: Record<number, { name: string; coins: number }> = {
        5655: { name: 'Rose', coins: 1 },
        5827: { name: 'Ice Cream Cone', coins: 1 },
        5269: { name: 'TikTok', coins: 1 },
        7934: { name: 'GG', coins: 1 },
        5487: { name: 'Finger Heart', coins: 5 },
        5658: { name: 'Perfume', coins: 20 },
        5660: { name: 'Doughnut', coins: 30 },
      };

      const onChat = (data: any) => {
        const username = extractTikTokUsername(data);
        const comment = extractTikTokComment(data);
        if (!comment) return;
        const avatarUrl = extractTikTokAvatar(data);
        console.log(`💬 [TIKTOK CHAT] ${username}: ${comment}`);
        broadcastSSE({
          type: 'TIKTOK_LIVE_EVENT',
          event: { type: 'chat', username, avatarUrl, comment },
        });
      };

      const onGift = (data: any) => {
        const giftType =
          data?.gift?.type ??
          data?.giftType ??
          data?.gift?.giftType ??
          data?.giftDetails?.giftType;
        const repeatEnd = Boolean(data?.repeatEnd ?? data?.gift?.repeatEnd);
        if (giftType === 1 && !repeatEnd) return;
        const username = extractTikTokUsername(data);
        const fallbackGift = GIFT_ID_FALLBACK[Number(data?.giftId)] || null;
        const diamondCount =
          Number(
            data?.gift?.diamondCount ??
              data?.giftDetails?.diamondCount ??
              data?.extendedGiftInfo?.diamond_count ??
              data?.diamondCount ??
              fallbackGift?.coins ??
              1
          ) || 1;
        const repeatCount = Math.max(
          1,
          Number(data?.repeatCount ?? data?.comboCount ?? 1) || 1
        );
        const giftName =
          data?.gift?.name ||
          data?.giftDetails?.giftName ||
          data?.extendedGiftInfo?.name ||
          data?.giftName ||
          fallbackGift?.name ||
          'Quà tặng';
        const coins = Math.max(1, diamondCount * repeatCount);
        const avatarUrl = extractTikTokAvatar(data);
        console.log(`🎁 [TIKTOK GIFT] ${username} tặng ${giftName} x${repeatCount} (${coins} xu)`);
        broadcastSSE({
          type: 'TIKTOK_LIVE_EVENT',
          event: { type: 'gift', username, avatarUrl, giftName, coins, repeatCount },
        });
      };

      const onLike = (data: any) => {
        const username = extractTikTokUsername(data);
        const likeCount = Math.max(
          1,
          Number(data?.likeCount ?? data?.count ?? data?.unmergedLikeCount ?? 1) || 1
        );
        const avatarUrl = extractTikTokAvatar(data);
        console.log(`❤️ [TIKTOK LIKE] ${username} thả ${likeCount} tim`);
        broadcastSSE({
          type: 'TIKTOK_LIVE_EVENT',
          event: { type: 'like', username, avatarUrl, likeCount },
        });
      };

      const onFollow = (data: any) => {
        const username = extractTikTokUsername(data);
        const avatarUrl = extractTikTokAvatar(data);
        console.log(`➕ [TIKTOK FOLLOW] ${username} đã follow`);
        broadcastSSE({
          type: 'TIKTOK_LIVE_EVENT',
          event: { type: 'follow', username, avatarUrl },
        });
      };

      conn.on('chat', onChat);
      conn.on('gift', onGift);
      conn.on('like', onLike);
      conn.on('follow', onFollow);
      conn.on('social', (data: any) => {
        const key = String(
          data?.displayType || data?.common?.displayText?.key || ''
        ).toLowerCase();
        if (key.includes('follow')) onFollow(data);
      });
      conn.on('error', (err: any) => {
        console.warn('⚠️ [TIKTOK ERROR]:', err?.message || err?.info || err);
      });
      conn.on('disconnected', () => {
        console.warn('🔄 [TIKTOK] Mất kết nối phòng Live');
      });

      const state = await conn.connect();
      activeTikTokStatus = 'connected';
      activeTikTokRoomId = String(state?.roomId || '');
      console.log(`✅ [TIKTOK LIVE] Đã kết nối phòng @${rawUser} (Room ID: ${activeTikTokRoomId})`);
      broadcastSSE({
        type: 'TIKTOK_LIVE_STATUS',
        status: 'connected',
        username: rawUser,
        roomId: activeTikTokRoomId,
        message: `Đã kết nối phòng Live @${rawUser} (Room: ${activeTikTokRoomId})`,
      });
      res.json({ ok: true, roomId: activeTikTokRoomId, username: rawUser });
    } catch (err: any) {
      activeTikTokStatus = 'error';
      const errMsg = err?.message || 'Không thể kết nối phòng Live (kiểm tra ID hoặc trạng thái đang Live)';
      console.error('❌ [TIKTOK CONNECT ERROR]:', errMsg);
      broadcastSSE({
        type: 'TIKTOK_LIVE_STATUS',
        status: 'error',
        username: rawUser,
        message: errMsg,
      });
      res.status(500).json({ ok: false, error: errMsg });
    }
  });

  // In-memory LRU cache for TTS MP3 buffers to eliminate latency & repeated requests
  const ttsBufferCache = new Map<string, Buffer>();
  const MAX_TTS_CACHE_ITEMS = 160;

  async function fetchGoogleTtsBuffer(
    text: string,
    variant: string,
    lang = 'vi'
  ): Promise<{
    buf: Buffer;
    source: 'ram-cache' | 'google-gtx' | 'google-tw-ob';
    switchedMirror: boolean;
    failReason?: string;
  }> {
    const isSlow = variant === 'google-vi-slow' || variant === 'slow';
    const speedParam = isSlow ? '0.24' : '1';
    const tl = lang === 'en' || variant.includes('-en') ? 'en' : 'vi';
    const cacheKey = `${tl}:${variant}:${text}`;
    const cached = ttsBufferCache.get(cacheKey);
    if (cached) {
      ttsBufferCache.delete(cacheKey);
      ttsBufferCache.set(cacheKey, cached);
      return {
        buf: cached,
        source: 'ram-cache',
        switchedMirror: false,
      };
    }

    const encoded = encodeURIComponent(text);
    const gtxUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${tl}&client=gtx&ttsspeed=${speedParam}&q=${encoded}`;
    const twObUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${tl}&client=tw-ob&ttsspeed=${speedParam}&q=${encoded}`;
    const endpoints: Array<{ url: string; label: 'google-gtx' | 'google-tw-ob' }> =
      variant === 'google-vi-twob'
        ? [
            { url: twObUrl, label: 'google-tw-ob' },
            { url: gtxUrl, label: 'google-gtx' },
          ]
        : [
            { url: gtxUrl, label: 'google-gtx' },
            { url: twObUrl, label: 'google-tw-ob' },
          ];

    let lastErr: unknown = null;
    let firstFailReason = '';
    for (let idx = 0; idx < endpoints.length; idx++) {
      const ep = endpoints[idx];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2200);
      try {
        const response = await fetch(ep.url, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Referer: 'https://translate.google.com/',
          },
        });
        clearTimeout(timeout);
        if (!response.ok) {
          const reason = `HTTP ${response.status} (${ep.label})`;
          if (!firstFailReason) firstFailReason = reason;
          lastErr = new Error(reason);
          continue;
        }
        const arrayBuffer = await response.arrayBuffer();
        const buf = Buffer.from(arrayBuffer);
        if (buf.length < 128) {
          const reason = `Buffer rỗng (${ep.label})`;
          if (!firstFailReason) firstFailReason = reason;
          lastErr = new Error(reason);
          continue;
        }
        if (ttsBufferCache.size >= MAX_TTS_CACHE_ITEMS) {
          const oldestKey = ttsBufferCache.keys().next().value;
          if (oldestKey) ttsBufferCache.delete(oldestKey);
        }
        ttsBufferCache.set(cacheKey, buf);
        return {
          buf,
          source: ep.label,
          switchedMirror: idx > 0,
          failReason: firstFailReason || undefined,
        };
      } catch (err: any) {
        clearTimeout(timeout);
        const reason =
          err?.name === 'AbortError'
            ? `Quá hạn >2.2s (${ep.label})`
            : `${err?.message || 'Lỗi mạng'} (${ep.label})`;
        if (!firstFailReason) firstFailReason = reason;
        lastErr = err;
      }
    }
    throw lastErr || new Error('All Google TTS mirrors failed');
  }

  // Built-in TTS Audio Proxy for OBS Browser Source compatibility (Multi-Mirror + Cache + Bilingual vi/en)
  app.get('/api/tts', async (req: Request, res: Response) => {
    try {
      const text = String(req.query.text || 'Nam mô A Di Đà Phật').trim().slice(0, 200);
      const voiceVariant = String(req.query.voice || 'google-vi-gtx').trim();
      const lang = String(req.query.lang || 'vi').trim().toLowerCase();
      const result = await fetchGoogleTtsBuffer(text, voiceVariant, lang);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-TTS-Source', result.source);
      res.setHeader('X-TTS-Switched', result.switchedMirror ? '1' : '0');
      if (result.failReason) {
        res.setHeader('X-TTS-Fail-Reason', encodeURIComponent(result.failReason));
      }
      res.setHeader(
        'Access-Control-Expose-Headers',
        'X-TTS-Source, X-TTS-Switched, X-TTS-Fail-Reason'
      );
      res.send(result.buf);
    } catch {
      res.status(502).end();
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err) => {
    console.error('⚠️ [SERVER LISTEN ERROR]:', err);
  });
}

startServer().catch((err) => {
  console.error('❌ [FATAL STARTUP ERROR]:', err);
});

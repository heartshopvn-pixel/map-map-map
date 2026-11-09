import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Plug, Radio, Terminal, Unplug } from 'lucide-react';
import { NODE_SERVER_CODE } from '../../config/constants';
import { syncService, WsConnectionStatus } from '../../services/syncService';

interface TabTikTokNodeProps {
  wsStatus: WsConnectionStatus;
  onConnectWs: (url: string) => void;
}

const SAVED_TIKTOK_ID_KEY = 'chua_online_tiktok_username_v1';

export const TabTikTokNode: React.FC<TabTikTokNodeProps> = ({ wsStatus, onConnectWs }) => {
  const [wsUrl, setWsUrl] = useState('ws://localhost:8080');
  const [tiktokUsername, setTiktokUsername] = useState(() => {
    try {
      return localStorage.getItem(SAVED_TIKTOK_ID_KEY) || '';
    } catch {
      return '';
    }
  });
  const [isConnectingRoom, setIsConnectingRoom] = useState(false);
  const [roomStatusMsg, setRoomStatusMsg] = useState('');
  const [liveLogs, setLiveLogs] = useState<string[]>(() => syncService.getTikTokLogs());
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const unsubLogs = syncService.onTikTokLog((logs) => {
      setLiveLogs([...logs]);
    });
    const unsubRoom = syncService.onRoomInfoChange((info) => {
      if (info.message) setRoomStatusMsg(info.message);
      if (info.username && !tiktokUsername) {
        setTiktokUsername(info.username);
      }
    });
    return () => {
      unsubLogs();
      unsubRoom();
    };
  }, [tiktokUsername]);

  const handleSaveUsername = (val: string) => {
    setTiktokUsername(val);
    try {
      localStorage.setItem(SAVED_TIKTOK_ID_KEY, val.trim().replace(/^@+/, ''));
    } catch {
      // Ignore
    }
  };

  const handleConnectDirectRoom = async () => {
    const clean = tiktokUsername.trim().replace(/^@+/, '');
    if (!clean) {
      setRoomStatusMsg('⚠️ Vui lòng nhập ID kênh TikTok đang phát Live!');
      return;
    }
    setIsConnectingRoom(true);
    setRoomStatusMsg(`⏳ Đang kết nối tới phòng Live @${clean}...`);
    const res = await syncService.connectTikTokRoom(clean);
    setIsConnectingRoom(false);
    if (res.ok) {
      setRoomStatusMsg(`✅ Đã kết nối phòng Live @${clean} (Room ID: ${res.roomId || 'OK'})`);
    } else {
      setRoomStatusMsg(`❌ ${res.error || 'Không kết nối được, hãy kiểm tra kênh đã bật Live chưa'}`);
    }
  };

  const customizedServerCode = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const cleanUser = tiktokUsername.trim().replace(/^@+/, '') || 'ten_id_tiktok_cua_ban';
    return NODE_SERVER_CODE
      .replace('ten_id_tiktok_cua_ban', cleanUser)
      .replace('__CLOUD_RELAY_URL__', origin);
  }, [tiktokUsername]);

  const handleCopyServer = () => {
    navigator.clipboard.writeText(customizedServerCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="space-y-3.5">
      {/* 1. Kết nối Trực Tiếp bằng ID Kênh TikTok (Không cần sửa code thủ công) */}
      <section className="p-3 rounded-xl bg-stone-900/90 border border-amber-500/40 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <h2 className="text-xs font-bold text-amber-200">
              1. Kết Nối Phiên TikTok Live Theo ID Kênh
            </h2>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              wsStatus === 'connected'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                : wsStatus === 'connecting'
                ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                : wsStatus === 'error'
                ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                : 'bg-stone-800 text-stone-400'
            }`}
          >
            {wsStatus === 'connected'
              ? '🟢 Đã kết nối Live'
              : wsStatus === 'connecting'
              ? '🟡 Đang kết nối...'
              : wsStatus === 'error'
              ? '🔴 Lỗi kết nối'
              : '⚪ Chế độ Giả lập'}
          </span>
        </div>

        <p className="text-[10.5px] text-stone-300 leading-relaxed">
          Nhập <b>ID TikTok đang Live</b> (ví dụ: <code className="text-amber-300">lophocthaygiao</code>) rồi bấm <b>Kết nối Live</b>. Hệ thống sẽ tự động điền sẵn ID này vào mã <code className="text-amber-300">server.js</code> bên dưới và đồng bộ trực tiếp cả qua WebSocket lẫn Cloud Relay!
        </p>

        <div className="flex gap-1.5">
          <input
            type="text"
            value={tiktokUsername}
            onChange={(e) => handleSaveUsername(e.target.value)}
            placeholder="Nhập ID TikTok đang Live (VD: @ten_id_tiktok)"
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs font-mono text-amber-200 focus:outline-none focus:border-amber-400"
          />
          <button
            type="button"
            disabled={isConnectingRoom}
            onClick={handleConnectDirectRoom}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-stone-950 font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer transition"
          >
            <Plug className="w-3.5 h-3.5" />
            <span>{isConnectingRoom ? 'Đang vào...' : 'Kết nối Live'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              syncService.disconnectTikTokRoom();
              setRoomStatusMsg('⏹️ Đã ngắt kết nối phiên Live.');
            }}
            className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer transition"
          >
            <Unplug className="w-3.5 h-3.5" />
            <span>Ngắt</span>
          </button>
        </div>

        {roomStatusMsg && (
          <div className="px-2.5 py-1.5 rounded-lg bg-stone-950/90 border border-stone-800 text-[11px] font-mono text-amber-300">
            {roomStatusMsg}
          </div>
        )}
      </section>

      {/* 2. Kết nối WebSocket Local Bridge */}
      <section className="p-3 rounded-xl bg-stone-900/80 border border-stone-800 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-stone-200">
            2. Đường Dẫn WebSocket Local Bridge (CMD / TikFinity)
          </h2>
          <span className="text-[10px] font-mono text-emerald-400">
            Chuẩn: ws://localhost:8080
          </span>
        </div>

        <div className="flex gap-1.5">
          <input
            type="text"
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-xs font-mono text-stone-200 focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            onClick={() => onConnectWs(wsUrl)}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer transition"
          >
            <Plug className="w-3.5 h-3.5" />
            <span>Kết nối WS</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setWsUrl('ws://localhost:8080');
              onConnectWs('ws://localhost:8080');
            }}
            className="px-2 py-1 rounded bg-stone-950 hover:bg-stone-800 border border-stone-700 text-[10px] text-stone-200 cursor-pointer"
          >
            Node.js (ws://localhost:8080)
          </button>
          <button
            type="button"
            onClick={() => {
              setWsUrl('ws://127.0.0.1:8080');
              onConnectWs('ws://127.0.0.1:8080');
            }}
            className="px-2 py-1 rounded bg-stone-950 hover:bg-stone-800 border border-emerald-500/40 text-[10px] text-emerald-300 cursor-pointer"
          >
            Node.js IPv4 (ws://127.0.0.1:8080)
          </button>
          <button
            type="button"
            onClick={() => {
              setWsUrl('ws://localhost:21213');
              onConnectWs('ws://localhost:21213');
            }}
            className="px-2 py-1 rounded bg-stone-950 hover:bg-stone-800 border border-amber-500/40 text-[10px] text-amber-300 cursor-pointer"
          >
            TikFinity (ws://localhost:21213)
          </button>
        </div>
      </section>

      {/* 3. Màn hình Nhật ký tương tác thực tế (Kiểm tra Comment / Gift ngay trên Web) */}
      <section className="p-3 rounded-xl bg-stone-900/80 border border-stone-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <h2 className="text-xs font-bold text-stone-200">
              Nhật Ký Tín Hiệu Phiên Live (Comment / Quà / Tim)
            </h2>
          </div>
          <span className="text-[10px] text-stone-400 font-mono">
            {liveLogs.length} sự kiện
          </span>
        </div>
        <div className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 font-mono text-[10.5px] text-emerald-300 max-h-36 overflow-y-auto space-y-1">
          {liveLogs.length === 0 ? (
            <div className="text-stone-500 italic">
              Chưa có tín hiệu. Khi kết nối phiên Live, toàn bộ Comment, Quà tặng và Tim sẽ hiện trực tiếp tại đây và trên màn hình CMD...
            </div>
          ) : (
            liveLogs.map((log, i) => (
              <div key={i} className="leading-snug break-words">
                {log}
              </div>
            ))
          )}
        </div>
      </section>

      {/* 4. Mã nguồn server.js (Đã tự động gắn ID TikTok & Cloud Relay) */}
      <section className="p-3 rounded-xl bg-stone-900/80 border border-stone-800 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-stone-200">
              Mã Nguồn <code className="text-amber-300">server.js</code> (Đã fix log CMD + Cổng 8080)
            </h2>
            <p className="text-[10px] text-stone-400 font-mono mt-0.5">
              npm i tiktok-live-connector ws express cors msedge-tts
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyServer}
            className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-[11px] font-bold text-amber-300 flex items-center gap-1 shrink-0 cursor-pointer"
          >
            {copiedCode ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>{copiedCode ? 'Đã chép server.js mới' : 'Chép server.js mới'}</span>
          </button>
        </div>

        <pre className="p-3 rounded-lg bg-stone-950 border border-stone-800 text-[10px] font-mono text-amber-200/90 overflow-x-auto max-h-56 leading-relaxed select-all">
          {customizedServerCode}
        </pre>
      </section>
    </div>
  );
};

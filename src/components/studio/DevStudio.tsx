import React, { useMemo, useState } from 'react';
import {
  Bot,
  Camera,
  Check,
  Copy,
  Flame,
  Gamepad2,
  Layout,
  MapPin,
  PanelRightClose,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ActivityLogItem } from '../../hooks/useClassroomEngine';
import { EventTtsQueueSnapshot } from '../../services/soundEngine';
import { WsConnectionStatus } from '../../services/syncService';
import {
  CameraFocusState,
  CameraQueueItem,
  DevTabId,
  GameConfig,
  ProvinceCell,
  SafetyActionMode,
  SafetyCategory,
  SafetyLogEntry,
} from '../../types/game';
import { TabControl } from './TabControl';
import { TabEvent } from './TabEvent';
import { TabCamera } from './TabCamera';
import { TabAudio } from './TabAudio';
import { TabNpc } from './TabNpc';
import { TabSafety } from './TabSafety';
import { TabMapEditor } from './TabMapEditor';
import { TabLayout } from './TabLayout';
import { TabVfx } from './TabVfx';
import { TabTikTokNode } from './TabTikTokNode';

interface DevStudioProps {
  activeTab: DevTabId;
  onSelectTab: (tab: DevTabId) => void;
  onCloseStudio: () => void;
  isLocalTabMuted: boolean;
  onToggleLocalMute: () => void;
  wsStatus: WsConnectionStatus;
  peerCounts: { totalPeers: number; obsPeers: number };
  onConnectWs: (url: string) => void;
  config: GameConfig;
  provinces: ProvinceCell[];
  activityLogs: ActivityLogItem[];
  onUpdateConfig: (partial: Partial<GameConfig>) => void;
  ttsStatus: { text: string; active: boolean };
  eventTtsQueue: EventTtsQueueSnapshot;
  onClearEventTtsQueue: () => void;
  onPanicMute: () => void;
  onTestTTS: () => void;
  onSimulateComment: (
    username: string,
    comment: string,
    avatarUrl?: string | null,
    forceProvinceId?: string,
    forceIsRose?: boolean
  ) => boolean;
  onTriggerRandomGift: (
    isRose: boolean,
    specificProvinceId?: string,
    customUsername?: string,
    isNpc?: boolean,
    roseCountOverride?: number
  ) => void;
  onTriggerBatchSameProvince: (
    provinceId?: string,
    senderCount?: number,
    isRose?: boolean
  ) => void;
  onResetAllProvinces: () => void;
  onSetProvincePoints: (provinceId: string, points: number) => void;
  onRenameProvince: (provinceId: string, newName: string) => void;
  cameraFocus: CameraFocusState;
  cameraQueue: CameraQueueItem[];
  onFocusProvince: (provinceId: string) => void;
  onSkipCameraTarget: () => void;
  onResetCameraView: () => void;
  onClearCameraQueue: () => void;
  onRemoveCameraQueueItem: (queueId: string) => void;
  npcNames: string[];
  npcAvatars: string[];
  onUpdateNpcNames: (names: string[]) => void;
  onResetNpcNames: () => void;
  onUpdateNpcAvatars: (avatars: string[]) => void;
  onResetNpcAvatars: () => void;
  safetyActionMode: SafetyActionMode;
  safetyCategories: SafetyCategory[];
  customWords: string[];
  safetyLogs: SafetyLogEntry[];
  onChangeSafetyMode: (mode: SafetyActionMode) => void;
  onToggleSafetyCategory: (key: string, enabled: boolean) => void;
  onAddCustomWords: (rawInput: string) => void;
  onRemoveCustomWord: (word: string) => void;
  onResetCustomWords: () => void;
  onClearSafetyLogs: () => void;
  onSaveBackupJson: () => void;
  onLoadBackupJson: (rawJsonText: string) => { ok: boolean; message: string };
  onPushFullSyncToLive: () => void;
  compactRemoteStage: boolean;
  onToggleCompactRemoteStage: () => void;
  onTriggerSessionEndNow?: () => void;
}

const TABS: {
  id: DevTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'control', label: 'Điều Khiển', icon: Gamepad2 },
  { id: 'audio', label: 'Âm Thanh', icon: Volume2 },
  { id: 'event', label: 'Sự Kiện', icon: Flame },
  { id: 'camera', label: 'Camera', icon: Camera },
  { id: 'npc', label: 'NPC', icon: Bot },
  { id: 'safety', label: 'An Toàn', icon: ShieldCheck },
  { id: 'map', label: 'Map', icon: MapPin },
  { id: 'layout', label: 'Layout', icon: Layout },
  { id: 'vfx', label: 'VFX', icon: Sparkles },
  { id: 'tiktok', label: 'TikTok', icon: Radio },
];

export const DevStudio: React.FC<DevStudioProps> = ({
  activeTab,
  onSelectTab,
  onCloseStudio,
  isLocalTabMuted,
  onToggleLocalMute,
  wsStatus,
  peerCounts,
  onConnectWs,
  config,
  provinces,
  activityLogs,
  onUpdateConfig,
  ttsStatus,
  eventTtsQueue,
  onClearEventTtsQueue,
  onPanicMute,
  onTestTTS,
  onSimulateComment,
  onTriggerRandomGift,
  onTriggerBatchSameProvince,
  onResetAllProvinces,
  onSetProvincePoints,
  onRenameProvince,
  cameraFocus,
  cameraQueue,
  onFocusProvince,
  onSkipCameraTarget,
  onResetCameraView,
  onClearCameraQueue,
  onRemoveCameraQueueItem,
  npcNames,
  npcAvatars,
  onUpdateNpcNames,
  onResetNpcNames,
  onUpdateNpcAvatars,
  onResetNpcAvatars,
  safetyActionMode,
  safetyCategories,
  customWords,
  safetyLogs,
  onChangeSafetyMode,
  onToggleSafetyCategory,
  onAddCustomWords,
  onRemoveCustomWord,
  onResetCustomWords,
  onClearSafetyLogs,
  onSaveBackupJson,
  onLoadBackupJson,
  onPushFullSyncToLive,
  compactRemoteStage,
  onToggleCompactRemoteStage,
  onTriggerSessionEndNow,
}) => {
  const [copiedLiveUrl, setCopiedLiveUrl] = useState(false);
  const [syncPushedToast, setSyncPushedToast] = useState(false);

  const activeProvinceCount = useMemo(
    () => provinces.filter((p) => p.points > 0).length,
    [provinces]
  );
  const totalPoints = useMemo(
    () => provinces.reduce((sum, p) => sum + p.points, 0),
    [provinces]
  );
  const totalGiftsCount = useMemo(
    () => provinces.reduce((sum, p) => sum + p.giftCount, 0),
    [provinces]
  );

  const handleCopyPureLiveUrl = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const pureUrl = `${baseUrl}?view=live`;
    navigator.clipboard.writeText(pureUrl);
    setCopiedLiveUrl(true);
    setTimeout(() => setCopiedLiveUrl(false), 2000);
  };

  const handleTriggerFullSync = () => {
    onPushFullSyncToLive();
    setSyncPushedToast(true);
    setTimeout(() => setSyncPushedToast(false), 1800);
  };

  return (
    <aside className="w-[410px] max-w-full h-full bg-stone-950 border-l border-stone-800 flex flex-col text-stone-100 select-none shrink-0 z-30">
      {/* Top Studio Header */}
      <header className="px-3.5 py-2.5 border-b border-stone-800 flex items-center justify-between gap-2 bg-stone-900/60">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              wsStatus === 'connected'
                ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                : wsStatus === 'connecting'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-stone-600'
            }`}
          />
          <div className="truncate">
            <h1 className="text-xs font-extrabold tracking-wide text-amber-300 uppercase truncate">
              Gửi Quà Về Tỉnh Của Tôi
            </h1>
            <p className="text-[10px] text-stone-400 truncate">
              {activeProvinceCount}/34 tỉnh có quà • {totalPoints} điểm •{' '}
              {totalGiftsCount} lượt
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleCompactRemoteStage}
            title="Tắt vẽ 2D ở tab điều khiển để nhẹ máy"
            className={`px-2 py-1 rounded-md border text-[10px] font-bold transition cursor-pointer ${
              compactRemoteStage
                ? 'bg-amber-500 text-stone-950 border-amber-400'
                : 'bg-stone-900 hover:bg-stone-800 text-stone-300 border-stone-700'
            }`}
          >
            {compactRemoteStage ? 'Hiện Map' : 'Tắt 2D'}
          </button>

          <button
            type="button"
            onClick={onToggleLocalMute}
            title="Tắt/Bật tiếng riêng trên Tab này"
            className={`px-2 py-1 rounded-md border text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer ${
              isLocalTabMuted
                ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                : 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-emerald-300'
            }`}
          >
            {isLocalTabMuted ? (
              <>
                <VolumeX className="w-3 h-3" />
                <span>Tắt</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3 h-3" />
                <span>Tiếng</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleTriggerFullSync}
            title="Đồng bộ điểm số sang cửa sổ OBS (?view=live)"
            className="px-2 py-1 rounded-md bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[10px] font-semibold text-cyan-300 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw
              className={`w-3 h-3 ${syncPushedToast ? 'animate-spin' : ''}`}
            />
            <span>
              {syncPushedToast ? 'Đã Sync' : `OBS (${peerCounts.obsPeers})`}
            </span>
          </button>

          <button
            type="button"
            onClick={handleCopyPureLiveUrl}
            title="Copy link sạch ?view=live cho OBS / TikTok Live Studio"
            className="px-2 py-1 rounded-md bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[10px] font-semibold text-amber-300 flex items-center gap-1 cursor-pointer"
          >
            {copiedLiveUrl ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>Link Live</span>
          </button>

          <button
            type="button"
            onClick={onCloseStudio}
            title="Ẩn bảng Dev (F2)"
            className="p-1.5 rounded-md bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-400 hover:text-stone-100 cursor-pointer"
          >
            <PanelRightClose className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 9-Tab Navigation Bar */}
      <nav className="grid grid-cols-5 gap-1 p-2 border-b border-stone-800 bg-stone-900/30">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`py-1.5 px-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                active
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                  : 'bg-stone-900/80 hover:bg-stone-800 text-stone-300 border border-stone-800/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Active Tab Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {activeTab === 'control' && (
          <TabControl
            config={config}
            provinces={provinces}
            activityLogs={activityLogs}
            onUpdateConfig={onUpdateConfig}
            onSimulateComment={onSimulateComment}
            onTriggerRandomGift={onTriggerRandomGift}
            onTriggerBatchSameProvince={onTriggerBatchSameProvince}
            onResetAllProvinces={onResetAllProvinces}
            onFocusProvince={onFocusProvince}
            onTriggerSessionEndNow={onTriggerSessionEndNow}
          />
        )}

        {activeTab === 'event' && (
          <TabEvent
            config={config}
            onUpdateConfig={onUpdateConfig}
            onTriggerRandomGift={onTriggerRandomGift}
          />
        )}

        {activeTab === 'camera' && (
          <TabCamera
            config={config}
            provinces={provinces}
            cameraFocus={cameraFocus}
            cameraQueue={cameraQueue}
            onUpdateConfig={onUpdateConfig}
            onFocusProvince={onFocusProvince}
            onSkipCameraTarget={onSkipCameraTarget}
            onResetCameraView={onResetCameraView}
            onClearCameraQueue={onClearCameraQueue}
            onRemoveCameraQueueItem={onRemoveCameraQueueItem}
          />
        )}

        {activeTab === 'audio' && (
          <TabAudio
            config={config}
            ttsStatus={ttsStatus}
            eventTtsQueue={eventTtsQueue}
            onUpdateConfig={onUpdateConfig}
            onClearEventTtsQueue={onClearEventTtsQueue}
            onPanicMute={onPanicMute}
            onTestTTS={onTestTTS}
          />
        )}

        {activeTab === 'npc' && (
          <TabNpc
            config={config}
            npcNames={npcNames}
            npcAvatars={npcAvatars}
            onUpdateConfig={onUpdateConfig}
            onUpdateNpcNames={onUpdateNpcNames}
            onResetNpcNames={onResetNpcNames}
            onUpdateNpcAvatars={onUpdateNpcAvatars}
            onResetNpcAvatars={onResetNpcAvatars}
            onTriggerRandomGift={onTriggerRandomGift}
          />
        )}

        {activeTab === 'safety' && (
          <TabSafety
            actionMode={safetyActionMode}
            categories={safetyCategories}
            customWords={customWords}
            logs={safetyLogs}
            onChangeActionMode={onChangeSafetyMode}
            onToggleCategory={onToggleSafetyCategory}
            onAddCustomWords={onAddCustomWords}
            onRemoveCustomWord={onRemoveCustomWord}
            onResetCustomWords={onResetCustomWords}
            onClearLogs={onClearSafetyLogs}
            onSpawnTrollTest={() =>
              onSimulateComment(
                'Châu Tinh Trùng',
                'v.c.l kubet tặng quà Hà Nội'
              )
            }
          />
        )}

        {activeTab === 'map' && (
          <TabMapEditor
            config={config}
            provinces={provinces}
            onUpdateConfig={onUpdateConfig}
            onSetProvincePoints={onSetProvincePoints}
            onRenameProvince={onRenameProvince}
            onResetAllProvinces={onResetAllProvinces}
            onFocusProvince={onFocusProvince}
          />
        )}

        {activeTab === 'layout' && (
          <TabLayout
            config={config}
            onUpdateConfig={onUpdateConfig}
            onSaveBackupJson={onSaveBackupJson}
            onLoadBackupJson={onLoadBackupJson}
          />
        )}

        {activeTab === 'vfx' && (
          <TabVfx
            config={config}
            onUpdateConfig={onUpdateConfig}
            onTriggerRandomGift={onTriggerRandomGift}
            onSaveBackupJson={onSaveBackupJson}
            onLoadBackupJson={onLoadBackupJson}
          />
        )}

        {activeTab === 'tiktok' && (
          <TabTikTokNode wsStatus={wsStatus} onConnectWs={onConnectWs} />
        )}
      </div>
    </aside>
  );
};

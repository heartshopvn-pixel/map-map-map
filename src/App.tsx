/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { PanelRightOpen, Volume2, VolumeX } from 'lucide-react';
import { DevTabId } from './types/game';
import { useClassroomEngine } from './hooks/useClassroomEngine';
import { GameStage } from './components/stage/GameStage';
import { DevStudio } from './components/studio/DevStudio';

export default function App() {
  const isPureStreamMode =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('view') === 'live' ||
      new URLSearchParams(window.location.search).get('mode') === 'live' ||
      new URLSearchParams(window.location.search).get('obs') === '1');

  const [studioOpen, setStudioOpen] = useState(!isPureStreamMode);
  const [activeTab, setActiveTab] = useState<DevTabId>('control');
  const [compactRemoteStage, setCompactRemoteStage] = useState<boolean>(() => {
    if (isPureStreamMode || typeof window === 'undefined') return false;
    return sessionStorage.getItem('tinh_compact_remote_stage') === 'true';
  });

  const engine = useClassroomEngine();

  const activeProvinceCount = useMemo(
    () => engine.provinces.filter((p) => p.points > 0).length,
    [engine.provinces]
  );
  const totalPoints = useMemo(
    () => engine.provinces.reduce((sum, p) => sum + p.points, 0),
    [engine.provinces]
  );
  const totalGiftsCount = useMemo(
    () => engine.provinces.reduce((sum, p) => sum + p.giftCount, 0),
    [engine.provinces]
  );

  const handleToggleCompactRemoteStage = () => {
    setCompactRemoteStage((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(
          'tinh_compact_remote_stage',
          next ? 'true' : 'false'
        );
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const shouldHideHeavyStage =
    !isPureStreamMode && studioOpen && compactRemoteStage;

  // Keyboard shortcut F2 to toggle Dev Studio for OBS clean capture
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setStudioOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-row items-stretch justify-between bg-stone-950 overflow-hidden relative">
      {/* Minimal Floating Trigger ONLY when Dev Studio is hidden and not in ?obs=1 pure mode */}
      {!studioOpen && !isPureStreamMode && (
        <div className="fixed top-2.5 right-2.5 z-50 flex items-center gap-1 opacity-35 hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={engine.handleToggleLocalMute}
            className="px-2 py-1 rounded-md bg-stone-900/95 border border-stone-700 text-[10px] font-medium text-stone-200 flex items-center gap-1 shadow-lg cursor-pointer"
          >
            {engine.isLocalTabMuted ? (
              <>
                <VolumeX className="w-3 h-3 text-rose-400" />
                <span>Tab tắt tiếng</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3 h-3 text-emerald-400" />
                <span>Tab có tiếng</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setStudioOpen(true)}
            className="px-2.5 py-1 rounded-md bg-stone-900/95 hover:bg-stone-800 border border-amber-500/40 text-[10px] font-semibold text-amber-300 flex items-center gap-1 shadow-lg cursor-pointer"
          >
            <PanelRightOpen className="w-3 h-3" />
            <span>Mở Studio (F2)</span>
          </button>
        </div>
      )}

      {/* Left Area: 9:16 Map Stage OR Lightweight Remote Monitor when compactRemoteStage is active */}
      {shouldHideHeavyStage ? (
        <div className="flex-1 h-full bg-stone-950 flex flex-col items-center justify-center p-6 select-none overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-stone-900/90 border border-amber-500/30 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-stone-800 pb-3">
              <div>
                <div className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Chế độ Remote Siêu Nhẹ (Đã ẩn Bản Đồ 2D)
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Giúp tiết kiệm tài nguyên CPU/GPU khi điều khiển phiên TikTok
                  Live
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleCompactRemoteStage}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-extrabold cursor-pointer shrink-0 transition"
              >
                Hiện Bản Đồ
              </button>
            </div>

            {/* Trạng thái Bản Đồ & Camera */}
            <div className="rounded-xl bg-stone-950/90 border border-stone-800 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-300">
                  {activeProvinceCount}/34 tỉnh có quà
                </span>
                <span className="font-mono font-bold text-amber-300">
                  Tổng: {totalPoints} điểm ({totalGiftsCount} lượt)
                </span>
              </div>
              <div className="text-[11px] text-stone-300">
                Camera:{' '}
                <strong className="text-amber-300">
                  {engine.cameraFocus.provinceId
                    ? `Đang zoom vào ${engine.cameraFocus.provinceName}`
                    : 'Đang ở Map mặc định'}
                </strong>
              </div>
            </div>

            {/* Trạng thái Giọng Đọc AI #3 */}
            <div className="rounded-xl bg-stone-950/90 border border-stone-800 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-400 font-semibold">
                  Giọng đọc AI #3 trên Live:
                </span>
                <span
                  className={`font-bold ${
                    engine.eventTtsQueue.isPlayingEvent
                      ? 'text-emerald-400'
                      : 'text-stone-400'
                  }`}
                >
                  {engine.eventTtsQueue.isPlayingEvent
                    ? 'Đang phát giọng đọc'
                    : 'Sẵn sàng'}
                </span>
              </div>
              <div className="text-xs text-stone-200 font-medium line-clamp-2 bg-stone-900/80 p-2 rounded border border-stone-800/60 min-h-[36px]">
                {engine.eventTtsQueue.currentEventText ||
                  'Không có câu đọc nào đang phát'}
              </div>
              <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1">
                <span>
                  Hàng chờ âm thanh:{' '}
                  <strong className="text-amber-300">
                    {engine.eventTtsQueue.waitingCount}
                  </strong>{' '}
                  câu
                </span>
                <span>
                  Hàng chờ Camera:{' '}
                  <strong className="text-cyan-300">
                    {engine.cameraQueue.length}
                  </strong>{' '}
                  lượt
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <GameStage
          config={engine.config}
          provinces={engine.provinces}
          cameraFocus={engine.cameraFocus}
          thrownAvatars={engine.thrownAvatars}
          npcAvatars={engine.npcAvatars}
          sessionEndSummary={engine.sessionEndSummary}
          cameraQueueCount={engine.cameraQueue.length}
          eventTtsQueue={engine.eventTtsQueue}
          onUpdateConfig={engine.handleUpdateConfig}
          onResetAllProvinces={engine.handleResetAllProvinces}
          onSessionTimeUp={engine.handleSessionTimeUp}
          onSelectProvince={(provinceId) =>
            engine.handleFocusProvinceManual(provinceId)
          }
        />
      )}

      {/* Right Area: Clean Collapsible Dev Studio */}
      {studioOpen && (
        <DevStudio
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onCloseStudio={() => setStudioOpen(false)}
          isLocalTabMuted={engine.isLocalTabMuted}
          onToggleLocalMute={engine.handleToggleLocalMute}
          wsStatus={engine.wsStatus}
          peerCounts={engine.peerCounts}
          onConnectWs={engine.onConnectWs}
          config={engine.config}
          provinces={engine.provinces}
          activityLogs={engine.activityLogs}
          onUpdateConfig={engine.handleUpdateConfig}
          ttsStatus={engine.ttsStatus}
          eventTtsQueue={engine.eventTtsQueue}
          onClearEventTtsQueue={engine.handleClearEventTtsQueue}
          onPanicMute={engine.handlePanicMute}
          onTestTTS={engine.handleTestTTS}
          onSimulateComment={engine.handleUserComment}
          onTriggerRandomGift={engine.handleTriggerRandomGift}
          onTriggerBatchSameProvince={engine.handleTriggerBatchSameProvince}
          onResetAllProvinces={engine.handleResetAllProvinces}
          onSetProvincePoints={engine.handleSetProvincePoints}
          onRenameProvince={engine.handleRenameProvince}
          cameraFocus={engine.cameraFocus}
          cameraQueue={engine.cameraQueue}
          onFocusProvince={engine.handleFocusProvinceManual}
          onSkipCameraTarget={engine.handleSkipCameraTarget}
          onResetCameraView={engine.handleResetCameraView}
          onClearCameraQueue={engine.handleClearCameraQueue}
          onRemoveCameraQueueItem={engine.handleRemoveCameraQueueItem}
          npcNames={engine.npcNames}
          npcAvatars={engine.npcAvatars}
          onUpdateNpcNames={engine.onUpdateNpcNames}
          onResetNpcNames={engine.onResetNpcNames}
          onUpdateNpcAvatars={engine.onUpdateNpcAvatars}
          onResetNpcAvatars={engine.onResetNpcAvatars}
          safetyActionMode={engine.safetyActionMode}
          safetyCategories={engine.safetyCategories}
          customWords={engine.customWords}
          safetyLogs={engine.safetyLogs}
          onChangeSafetyMode={engine.onChangeSafetyMode}
          onToggleSafetyCategory={engine.onToggleSafetyCategory}
          onAddCustomWords={engine.onAddCustomWords}
          onRemoveCustomWord={engine.onRemoveCustomWord}
          onResetCustomWords={engine.onResetCustomWords}
          onClearSafetyLogs={engine.onClearSafetyLogs}
          onSaveBackupJson={engine.handleSaveBackupJson}
          onLoadBackupJson={engine.handleLoadBackupJson}
          onPushFullSyncToLive={engine.handlePushFullSyncToLive}
          compactRemoteStage={compactRemoteStage}
          onToggleCompactRemoteStage={handleToggleCompactRemoteStage}
          onTriggerTurboBatchRead={engine.handleTriggerTurboBatchRead}
          onTriggerSessionEndNow={() =>
            engine.handleSessionTimeUp(engine.config.roundNumber || 69)
          }
        />
      )}
    </div>
  );
}

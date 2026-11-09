import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_GIFT_GUIDE_ITEMS,
  DEFAULT_HOW_TO_PLAY_CONFIG,
  DEFAULT_LAYOUT_POSITIONS,
  DEFAULT_LAYOUT_VISIBILITY,
  DEFAULT_NPC_AVATARS,
} from '../../config/constants';
import {
  resolveAvatarForUsername,
  SessionEndSummaryState,
} from '../../hooks/useClassroomEngine';
import { soundEngine } from '../../services/soundEngine';
import {
  buildVietnamProvincePolygons,
  MAP_RENDER_OFFSET_X,
  MAP_RENDER_OFFSET_Y,
  MAP_RENDER_SCALE,
  RAW_MAP_HEIGHT,
  RAW_MAP_WIDTH,
  SAFE_SQUARE_SIZE,
  SAFE_SQUARE_TOP,
  VIETNAM_ISLAND_CLUSTERS,
  VIETNAM_MAP_IMAGE_URL,
} from '../../services/vietnamMapGeometry';
import {
  CameraFocusState,
  GameConfig,
  GiftGuideItem,
  LayoutElementKey,
  ProvinceCell,
  ProvinceContributor,
  ThrownAvatarFX,
} from '../../types/game';

interface GameStageProps {
  config: GameConfig;
  provinces: ProvinceCell[];
  thrownAvatars: ThrownAvatarFX[];
  cameraFocus: CameraFocusState;
  npcAvatars?: string[];
  sessionEndSummary?: SessionEndSummaryState | null;
  cameraQueueCount?: number;
  onSelectProvince?: (provinceId: string) => void;
  onUpdateConfig?: (patch: Partial<GameConfig>) => void;
  onResetAllProvinces?: () => void;
  onSessionTimeUp?: (sessionNum: number) => void;
}

const STAGE_WIDTH = 540;

// 8 hướng nổ nhanh của Icon Hoa Hồng từ tâm tỉnh khi người chơi tặng hoa
const ROSE_BURST_VECTORS = [
  { tx: '-54px', ty: '-48px', rot: '-28deg', delay: '0ms' },
  { tx: '0px', ty: '-66px', rot: '8deg', delay: '25ms' },
  { tx: '56px', ty: '-46px', rot: '32deg', delay: '45ms' },
  { tx: '-68px', ty: '-6px', rot: '-42deg', delay: '35ms' },
  { tx: '68px', ty: '-4px', rot: '40deg', delay: '55ms' },
  { tx: '-46px', ty: '42px', rot: '-18deg', delay: '65ms' },
  { tx: '48px', ty: '40px', rot: '22deg', delay: '75ms' },
  { tx: '0px', ty: '-88px', rot: '-12deg', delay: '90ms' },
];

function isImageSource(val: string | undefined | null): boolean {
  if (!val) return false;
  return (
    val.startsWith('http://') ||
    val.startsWith('https://') ||
    val.startsWith('data:image') ||
    val.startsWith('/')
  );
}

interface DraggableBoxProps {
  elementKey: LayoutElementKey;
  label: string;
  config: GameConfig;
  scaleFactor: number;
  transformOrigin?: string;
  baseClassName?: string;
  baseStyle?: React.CSSProperties;
  onUpdateConfig?: (patch: Partial<GameConfig>) => void;
  children: React.ReactNode;
}

const DraggableLayoutBox: React.FC<DraggableBoxProps> = ({
  elementKey,
  label,
  config,
  scaleFactor,
  transformOrigin = 'top left',
  baseClassName = '',
  baseStyle = {},
  onUpdateConfig,
  children,
}) => {
  const pos =
    config.layoutPositions?.[elementKey] ||
    DEFAULT_LAYOUT_POSITIONS[elementKey] || {
      x: 0,
      y: 0,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
    };

  const currentScale = Math.max(0.35, Math.min(2.5, pos.scale ?? 1));
  const currentScaleX = Math.max(0.35, Math.min(3.0, pos.scaleX ?? 1));
  const currentScaleY = Math.max(0.35, Math.min(3.0, pos.scaleY ?? 1));

  const dragStartRef = useRef<{
    mode: 'move' | 'resize' | 'resize_x' | 'resize_y';
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
    startScale: number;
    startScaleX: number;
    startScaleY: number;
    dirSign: number;
  } | null>(null);
  const [interactionMode, setInteractionMode] = useState<
    'idle' | 'move' | 'resize' | 'resize_x' | 'resize_y'
  >('idle');

  const handleMovePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!config.layoutEditMode || !onUpdateConfig) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = {
      mode: 'move',
      pointerX: e.clientX,
      pointerY: e.clientY,
      startX: pos.x,
      startY: pos.y,
      startScale: currentScale,
      startScaleX: currentScaleX,
      startScaleY: currentScaleY,
      dirSign: 1,
    };
    setInteractionMode('move');
  };

  const handleResizePointerDown = (
    cornerDirX: number,
    cornerDirY: number,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!config.layoutEditMode || !onUpdateConfig) return;
    e.stopPropagation();
    e.preventDefault();
    const parentBox = e.currentTarget.parentElement;
    if (parentBox) {
      parentBox.setPointerCapture(e.pointerId);
    }
    dragStartRef.current = {
      mode: 'resize',
      pointerX: e.clientX * cornerDirX,
      pointerY: e.clientY * cornerDirY,
      startX: pos.x,
      startY: pos.y,
      startScale: currentScale,
      startScaleX: currentScaleX,
      startScaleY: currentScaleY,
      dirSign: 1,
    };
    setInteractionMode('resize');
  };

  const handleEdgeResizePointerDown = (
    axis: 'x' | 'y',
    dirSign: number,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!config.layoutEditMode || !onUpdateConfig) return;
    e.stopPropagation();
    e.preventDefault();
    const parentBox = e.currentTarget.parentElement;
    if (parentBox) {
      parentBox.setPointerCapture(e.pointerId);
    }
    dragStartRef.current = {
      mode: axis === 'x' ? 'resize_x' : 'resize_y',
      pointerX: e.clientX,
      pointerY: e.clientY,
      startX: pos.x,
      startY: pos.y,
      startScale: currentScale,
      startScaleX: currentScaleX,
      startScaleY: currentScaleY,
      dirSign,
    };
    setInteractionMode(axis === 'x' ? 'resize_x' : 'resize_y');
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || !config.layoutEditMode || !onUpdateConfig)
      return;
    e.stopPropagation();

    if (dragStartRef.current.mode === 'move') {
      const dx =
        (e.clientX - dragStartRef.current.pointerX) / (scaleFactor || 1);
      const dy =
        (e.clientY - dragStartRef.current.pointerY) / (scaleFactor || 1);
      const nextX = Math.round(dragStartRef.current.startX + dx);
      const nextY = Math.round(dragStartRef.current.startY + dy);

      onUpdateConfig({
        layoutPositions: {
          ...DEFAULT_LAYOUT_POSITIONS,
          ...(config.layoutPositions || {}),
          [elementKey]: {
            x: nextX,
            y: nextY,
            scale: dragStartRef.current.startScale,
            scaleX: dragStartRef.current.startScaleX,
            scaleY: dragStartRef.current.startScaleY,
          },
        },
      });
    } else if (dragStartRef.current.mode === 'resize_x') {
      const dx =
        ((e.clientX - dragStartRef.current.pointerX) *
          dragStartRef.current.dirSign) /
        (scaleFactor || 1);
      const deltaX = dx / 140;
      const nextScaleX = Number(
        Math.max(
          0.35,
          Math.min(3.0, dragStartRef.current.startScaleX + deltaX)
        ).toFixed(2)
      );
      onUpdateConfig({
        layoutPositions: {
          ...DEFAULT_LAYOUT_POSITIONS,
          ...(config.layoutPositions || {}),
          [elementKey]: {
            x: dragStartRef.current.startX,
            y: dragStartRef.current.startY,
            scale: dragStartRef.current.startScale,
            scaleX: nextScaleX,
            scaleY: dragStartRef.current.startScaleY,
          },
        },
      });
    } else if (dragStartRef.current.mode === 'resize_y') {
      const dy =
        ((e.clientY - dragStartRef.current.pointerY) *
          dragStartRef.current.dirSign) /
        (scaleFactor || 1);
      const deltaY = dy / 140;
      const nextScaleY = Number(
        Math.max(
          0.35,
          Math.min(3.0, dragStartRef.current.startScaleY + deltaY)
        ).toFixed(2)
      );
      onUpdateConfig({
        layoutPositions: {
          ...DEFAULT_LAYOUT_POSITIONS,
          ...(config.layoutPositions || {}),
          [elementKey]: {
            x: dragStartRef.current.startX,
            y: dragStartRef.current.startY,
            scale: dragStartRef.current.startScale,
            scaleX: dragStartRef.current.startScaleX,
            scaleY: nextScaleY,
          },
        },
      });
    } else {
      const signX = dragStartRef.current.pointerX >= 0 ? 1 : -1;
      const signY = dragStartRef.current.pointerY >= 0 ? 1 : -1;
      const startAbsX = Math.abs(dragStartRef.current.pointerX);
      const startAbsY = Math.abs(dragStartRef.current.pointerY);

      const dx = ((e.clientX - startAbsX) * signX) / (scaleFactor || 1);
      const dy = ((e.clientY - startAbsY) * signY) / (scaleFactor || 1);
      const delta = (dx + dy) / 180;
      const nextScale = Number(
        Math.max(
          0.35,
          Math.min(2.5, dragStartRef.current.startScale + delta)
        ).toFixed(2)
      );

      onUpdateConfig({
        layoutPositions: {
          ...DEFAULT_LAYOUT_POSITIONS,
          ...(config.layoutPositions || {}),
          [elementKey]: {
            x: dragStartRef.current.startX,
            y: dragStartRef.current.startY,
            scale: nextScale,
            scaleX: dragStartRef.current.startScaleX,
            scaleY: dragStartRef.current.startScaleY,
          },
        },
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    dragStartRef.current = null;
    setInteractionMode('idle');
  };

  const finalScaleX = Number((currentScale * currentScaleX).toFixed(3));
  const finalScaleY = Number((currentScale * currentScaleY).toFixed(3));

  return (
    <div
      onPointerDown={handleMovePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`${baseClassName} ${
        config.layoutEditMode
          ? 'pointer-events-auto cursor-move ring-2 ring-dashed ring-amber-400/95 rounded-xl bg-amber-500/10'
          : 'pointer-events-none'
      }`}
      style={{
        ...baseStyle,
        transformOrigin,
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0px) scale(${finalScaleX}, ${finalScaleY})`,
      }}
    >
      {config.layoutEditMode && (
        <>
          <div
            className={`absolute -top-5 left-1 z-50 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold uppercase tracking-wider whitespace-nowrap shadow ${
              interactionMode !== 'idle'
                ? 'bg-emerald-400 text-stone-950'
                : 'bg-amber-400 text-stone-950'
            }`}
          >
            ✥ {label} • {Math.round(currentScale * 100)}% (W:
            {Math.round(currentScaleX * 100)}% H:
            {Math.round(currentScaleY * 100)}%)
          </div>

          {/* 4 Nút kéo ở 4 Góc (Scale đều) */}
          <div
            onPointerDown={(e) => handleResizePointerDown(-1, -1, e)}
            title="Kéo góc để chỉnh kích thước đều"
            className="absolute -top-2 -left-2 z-50 w-4 h-4 rounded-full bg-emerald-400 border-2 border-stone-950 cursor-nwse-resize shadow-md"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown(1, -1, e)}
            title="Kéo góc để chỉnh kích thước đều"
            className="absolute -top-2 -right-2 z-50 w-4 h-4 rounded-full bg-emerald-400 border-2 border-stone-950 cursor-nesw-resize shadow-md"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown(-1, 1, e)}
            title="Kéo góc để chỉnh kích thước đều"
            className="absolute -bottom-2 -left-2 z-50 w-4 h-4 rounded-full bg-emerald-400 border-2 border-stone-950 cursor-nesw-resize shadow-md"
          />
          <div
            onPointerDown={(e) => handleResizePointerDown(1, 1, e)}
            title="Kéo góc để chỉnh kích thước (Scale nội dung)"
            className="absolute -bottom-2.5 -right-2.5 z-50 w-5 h-5 rounded-full bg-emerald-400 border-2 border-stone-950 cursor-nwse-resize shadow-lg flex items-center justify-center text-[9px] font-black text-stone-950"
          >
            ⤡
          </div>

          {/* 4 Thanh kéo ở 4 Cạnh (Kéo dài ngang / dọc riêng biệt) */}
          <div
            onPointerDown={(e) => handleEdgeResizePointerDown('x', 1, e)}
            title="Kéo cạnh phải để chỉnh chiều dài ngang"
            className="absolute top-1/2 -right-2 -translate-y-1/2 z-50 w-3 h-7 rounded-full bg-cyan-400 border border-stone-950 cursor-ew-resize shadow flex items-center justify-center text-[8px] font-black text-stone-950"
          >
            ↔
          </div>
          <div
            onPointerDown={(e) => handleEdgeResizePointerDown('x', -1, e)}
            title="Kéo cạnh trái để chỉnh chiều dài ngang"
            className="absolute top-1/2 -left-2 -translate-y-1/2 z-50 w-3 h-7 rounded-full bg-cyan-400 border border-stone-950 cursor-ew-resize shadow flex items-center justify-center text-[8px] font-black text-stone-950"
          >
            ↔
          </div>
          <div
            onPointerDown={(e) => handleEdgeResizePointerDown('y', 1, e)}
            title="Kéo cạnh dưới để chỉnh chiều dọc"
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-50 w-7 h-3 rounded-full bg-cyan-400 border border-stone-950 cursor-ns-resize shadow flex items-center justify-center text-[8px] font-black text-stone-950"
          >
            ↕
          </div>
          <div
            onPointerDown={(e) => handleEdgeResizePointerDown('y', -1, e)}
            title="Kéo cạnh trên để chỉnh chiều dọc"
            className="absolute -top-2 left-1/2 -translate-x-1/2 z-50 w-7 h-3 rounded-full bg-cyan-400 border border-stone-950 cursor-ns-resize shadow flex items-center justify-center text-[8px] font-black text-stone-950"
          >
            ↕
          </div>
        </>
      )}
      {children}
    </div>
  );
};

export const GameStage: React.FC<GameStageProps> = ({
  config,
  provinces,
  thrownAvatars,
  cameraFocus,
  npcAvatars = DEFAULT_NPC_AVATARS,
  sessionEndSummary = null,
  cameraQueueCount = 0,
  onSelectProvince,
  onUpdateConfig,
  onSessionTimeUp,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const [bgmNeedsUnlock, setBgmNeedsUnlock] = useState(false);

  useEffect(() => {
    const unsubBgm = soundEngine.subscribeBgmState((snap) => {
      setBgmNeedsUnlock(Boolean(snap.isPlaying && snap.needsUnlock));
    });
    return () => {
      unsubBgm();
    };
  }, []);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0) {
        setStageScale(rect.width / STAGE_WIDTH);
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Kiểm tra ẩn/hiện từng bảng theo cấu hình trong Tab Layout
  const isElementVisible = (key: LayoutElementKey): boolean => {
    const visMap = config.layoutVisibility || DEFAULT_LAYOUT_VISIBILITY;
    if (key === 'bottomPodium' && config.showBottomPodium === false) {
      return false;
    }
    if (key === 'giftToastBanner' && config.showGiftToastBanner === false) {
      return false;
    }
    return visMap[key] !== false;
  };

  // Đồng hồ đếm ngược Vòng gặp gỡ / Phiên chơi (thời gian X)
  const effectiveDuration =
    config.gamePlayMode === 'session_top5'
      ? Math.max(15, config.sessionDurationSec || 180)
      : Math.max(15, config.roundDurationSec || 180);

  const [secondsLeft, setSecondsLeft] = useState<number>(effectiveDuration);
  const [roundCounter, setRoundCounter] = useState<number>(
    () => config.roundNumber || 69
  );

  const secondsLeftRef = useRef<number>(effectiveDuration);
  secondsLeftRef.current = secondsLeft;

  useEffect(() => {
    setRoundCounter(config.roundNumber || 69);
  }, [config.roundNumber]);

  useEffect(() => {
    secondsLeftRef.current = effectiveDuration;
    setSecondsLeft(effectiveDuration);
  }, [effectiveDuration, config.gamePlayMode]);

  const onSessionTimeUpRef = useRef(onSessionTimeUp);
  onSessionTimeUpRef.current = onSessionTimeUp;

  const roundCounterRef = useRef(roundCounter);
  roundCounterRef.current = roundCounter;

  const isSummaryActive = Boolean(sessionEndSummary);
  const wasSummaryActiveRef = useRef<boolean>(false);

  useEffect(() => {
    if (isSummaryActive) {
      wasSummaryActiveRef.current = true;
      secondsLeftRef.current = 0;
      setSecondsLeft(0);
      return;
    }

    if (wasSummaryActiveRef.current) {
      // Ngay khi người đọc đọc xong hết tổng kết và đóng bảng tổng kết -> Bắt đầu đếm ngược phiên mới!
      wasSummaryActiveRef.current = false;
      secondsLeftRef.current = effectiveDuration;
      setSecondsLeft(effectiveDuration);
    }

    const timer = setInterval(() => {
      const currentSec = secondsLeftRef.current;
      if (currentSec <= 1) {
        const finishedSession = roundCounterRef.current;
        secondsLeftRef.current = 0;
        setSecondsLeft(0);
        if (onSessionTimeUpRef.current) {
          onSessionTimeUpRef.current(finishedSession);
        }
      } else {
        const nextSec = currentSec - 1;
        secondsLeftRef.current = nextSec;
        setSecondsLeft(nextSec);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [effectiveDuration, isSummaryActive]);

  const formattedTimer = useMemo(() => {
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [secondsLeft]);

  // Xây dựng hình học 34 tỉnh/thành nằm gọn trong Hình Vuông An Toàn 540x540 giữa màn hình
  const polygonMap = useMemo(
    () => buildVietnamProvincePolygons(provinces),
    [provinces]
  );

  // Thống kê tổng số hoa hồng, bình luận & người tham gia
  const stats = useMemo(() => {
    let totalRoses = 0;
    let totalGifts = 0;
    const uniqueUsers = new Set<string>();
    for (const p of provinces) {
      totalRoses += p.roseCount;
      totalGifts += p.giftCount;
      for (const c of p.recentContributors) {
        uniqueUsers.add(c.username.toLowerCase());
      }
    }
    const commentCount = Math.max(0, totalGifts - totalRoses);
    return {
      totalRoses,
      commentCount,
      totalGifts,
      participantCount: 200 + uniqueUsers.size + totalGifts,
    };
  }, [provinces]);

  // Top 5 tỉnh cao điểm nhất trong phiên hiện tại
  const top5Provinces = useMemo(() => {
    const sorted = [...provinces].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.code - b.code;
    });
    return sorted.slice(0, 5);
  }, [provinces]);

  // Danh sách 3 tỉnh đạt Top 1 nhiều nhất (đếm số lần đạt Top 1 qua các phiên, nếu bằng nhau xét điểm hiện tại)
  const top3MostTop1Provinces = useMemo(() => {
    const sorted = [...provinces].sort((a, b) => {
      const winA = a.top1WinCount || 0;
      const winB = b.top1WinCount || 0;
      if (winB !== winA) return winB - winA;
      if (b.points !== a.points) return b.points - a.points;
      return a.code - b.code;
    });
    return sorted.slice(0, 3);
  }, [provinces]);

  // Các tỉnh có điểm > 0 được sắp xếp theo tọa độ Y để chống chồng lấp nhãn trên Map mặc định
  const overviewLabels = useMemo(() => {
    const active = provinces.filter(
      (p) => p.points > 0 || config.showZeroPointProvinceNames
    );
    const items = active
      .map((prov) => {
        const poly = polygonMap.get(prov.id);
        if (!poly) return null;
        return {
          prov,
          poly,
          y: poly.labelLineEndY,
          side: poly.labelSide,
        };
      })
      .filter(Boolean) as Array<{
      prov: ProvinceCell;
      poly: NonNullable<ReturnType<typeof polygonMap.get>>;
      y: number;
      side: 'left' | 'right';
    }>;

    for (const side of ['left', 'right'] as const) {
      const group = items
        .filter((it) => it.side === side)
        .sort((a, b) => a.y - b.y);
      for (let i = 1; i < group.length; i++) {
        if (group[i].y - group[i - 1].y < 14) {
          group[i].y = group[i - 1].y + 14;
        }
      }
    }
    return items;
  }, [config.showZeroPointProvinceNames, polygonMap, provinces]);

  // Độ phóng đại khi Zoom vào tỉnh hỗ trợ tối đa lên đến 15x
  const currentZoomScale = useMemo(
    () => Math.max(1.5, Math.min(15, config.cameraZoomScale || 3.2)),
    [config.cameraZoomScale]
  );

  // =========================================================================
  // KỸ THUẬT ZOOM VECTOR TRỰC TIẾP TRONG <svg> QUA requestAnimationFrame:
  // - Không dùng CSS transform scale trên thẻ <div> bọc ngoài -> Loại bỏ hoàn toàn
  //   hiện tượng GPU upscale bitmap mờ rồi mới nét lại sau khi hết transition!
  // - Rasterize Vector trực tiếp ở mọi khung hình (60fps), dù zoom 15x vẫn sắc nét tức thì.
  // =========================================================================
  const svgCameraGroupRef = useRef<SVGGElement | null>(null);
  const animCameraRef = useRef<{ tx: number; ty: number; zoom: number }>({
    tx: 0,
    ty: 0,
    zoom: 1,
  });

  const targetCamera = useMemo(() => {
    if (!cameraFocus.provinceId) {
      return { tx: 0, ty: 0, zoom: 1, centerX: 270, centerY: 270 };
    }
    const targetPoly = polygonMap.get(cameraFocus.provinceId);
    if (!targetPoly) {
      return { tx: 0, ty: 0, zoom: 1, centerX: 270, centerY: 270 };
    }
    const zoom = currentZoomScale;
    const half = SAFE_SQUARE_SIZE / 2; // 270
    const tx = half - targetPoly.centerX * zoom;
    const ty = half - targetPoly.centerY * zoom;
    return {
      tx,
      ty,
      zoom,
      centerX: targetPoly.centerX,
      centerY: targetPoly.centerY,
    };
  }, [cameraFocus.provinceId, currentZoomScale, polygonMap]);

  useEffect(() => {
    const startTx = animCameraRef.current.tx;
    const startTy = animCameraRef.current.ty;
    const startZoom = animCameraRef.current.zoom;

    const durationMs = cameraFocus.isTurboPan
      ? 150
      : Math.max(0.18, Math.min(1.6, config.cameraSmoothSpeed || 0.5)) * 1000;
    const startTime = performance.now();
    let rafId = 0;

    // TRƯỜNG HỢP 1: ĐANG CÓ SỰ KIỆN ZOOM VÀO TỈNH
    if (cameraFocus.provinceId) {
      const endTx = targetCamera.tx;
      const endTy = targetCamera.ty;
      const endZoom = targetCamera.zoom;

      const stepZoomIn = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);

        const curTx = startTx + (endTx - startTx) * eased;
        const curTy = startTy + (endTy - startTy) * eased;
        const curZoom = startZoom + (endZoom - startZoom) * eased;

        animCameraRef.current = { tx: curTx, ty: curTy, zoom: curZoom };

        if (svgCameraGroupRef.current) {
          svgCameraGroupRef.current.setAttribute(
            'transform',
            `translate(${curTx.toFixed(2)}, ${curTy.toFixed(2)}) scale(${curZoom.toFixed(4)})`
          );
        }

        if (t < 1) {
          rafId = requestAnimationFrame(stepZoomIn);
        }
      };

      rafId = requestAnimationFrame(stepZoomIn);
      return () => cancelAnimationFrame(rafId);
    }

    // TRƯỜNG HỢP 2: BẢN ĐỒ MẶC ĐỊNH KHI KHÔNG CÓ SỰ KIỆN (2 CHẾ ĐỘ CHỜ):
    // - Chế độ 1 ('sway'): Đung đưa nhẹ (điều chỉnh biên độ & tốc độ trong VFX)
    // - Chế độ 2 ('pan_north_south'): Zoom lại gần Mũi Bắc hoặc Mũi Nam 1 chút rồi rê dần tới đầu kia của Map
    const idleMode = config.mapIdleMode || 'sway';
    const swayAmp = Math.max(
      0,
      Math.min(40, config.mapIdleSwayAmplitudePx ?? 8)
    );
    const swaySpeed = Math.max(
      0.2,
      Math.min(3.0, config.mapIdleSwaySpeed ?? 1.0)
    );
    const panZoom = Math.max(
      1.2,
      Math.min(3.2, config.mapIdlePanZoom ?? 1.65)
    );
    const panCycleSec = Math.max(
      6,
      Math.min(45, config.mapIdlePanCycleSec ?? 18)
    );
    const half = SAFE_SQUARE_SIZE / 2; // 270

    const computeIdlePose = (nowMs: number) => {
      const sec = nowMs / 1000;
      if (idleMode === 'pan_north_south') {
        // Rê mượt hai chiều từ Mũi Bắc (Lũng Cú / Đông-Tây Bắc) <-> Miền Trung <-> Mũi Nam (Mũi Cà Mau)
        const phase = (sec / panCycleSec) * Math.PI;
        const u = (1 - Math.cos(phase)) * 0.5; // 0 (Mũi Bắc) -> 1 (Mũi Nam) -> 0
        const inv = 1 - u;
        // Đường cong Bezier bám theo dáng chữ S Việt Nam trong khung 540x540
        const focusX =
          inv * inv * 238 +
          2 * inv * u * 308 +
          u * u * 224 +
          Math.sin(sec * 0.9) * 3.5;
        const focusY = inv * inv * 108 + 2 * inv * u * 274 + u * u * 452;
        const zoom = panZoom + Math.sin(sec * 0.7) * 0.03;
        return {
          tx: half - focusX * zoom,
          ty: half - focusY * zoom,
          zoom,
        };
      }

      // Mặc định: Chế độ 1 - Đung đưa nhẹ ('sway')
      const offsetX = Math.sin(sec * 1.15 * swaySpeed) * swayAmp;
      const offsetY = Math.cos(sec * 0.85 * swaySpeed) * (swayAmp * 0.68);
      const zoom =
        1 +
        Math.sin(sec * 0.55 * swaySpeed) * Math.min(0.035, swayAmp * 0.0022);
      return {
        tx: half * (1 - zoom) + offsetX,
        ty: half * (1 - zoom) + offsetY,
        zoom,
      };
    };

    const stepIdle = (now: number) => {
      const elapsed = now - startTime;
      const blendT = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - blendT, 3);

      const idlePose = computeIdlePose(now);
      const curTx = startTx + (idlePose.tx - startTx) * eased;
      const curTy = startTy + (idlePose.ty - startTy) * eased;
      const curZoom = startZoom + (idlePose.zoom - startZoom) * eased;

      animCameraRef.current = { tx: curTx, ty: curTy, zoom: curZoom };

      if (svgCameraGroupRef.current) {
        svgCameraGroupRef.current.setAttribute(
          'transform',
          `translate(${curTx.toFixed(2)}, ${curTy.toFixed(2)}) scale(${curZoom.toFixed(4)})`
        );
      }

      rafId = requestAnimationFrame(stepIdle);
    };

    rafId = requestAnimationFrame(stepIdle);
    return () => cancelAnimationFrame(rafId);
  }, [
    cameraFocus.provinceId,
    config.cameraSmoothSpeed,
    config.mapIdleMode,
    config.mapIdlePanCycleSec,
    config.mapIdlePanZoom,
    config.mapIdleSwayAmplitudePx,
    config.mapIdleSwaySpeed,
    targetCamera,
  ]);

  const focusedProvince = useMemo(
    () =>
      cameraFocus.provinceId
        ? provinces.find((p) => p.id === cameraFocus.provinceId) || null
        : null,
    [cameraFocus.provinceId, provinces]
  );

  // Đảm bảo cả Avatar To lẫn Avatar Nhỏ khi Zoom vào tỉnh đều có danh sách người chơi kèm ảnh thật
  // Cộng dồn theo tên người chơi để nếu cùng 1 người vừa comment +1đ vừa tặng hoa thì chỉ hiện 1 Avatar To duy nhất!
  const activeBatchedSenders = useMemo<ProvinceContributor[]>(() => {
    if (!cameraFocus.provinceId) return [];
    const rawList =
      cameraFocus.senders && cameraFocus.senders.length > 0
        ? cameraFocus.senders
        : focusedProvince && focusedProvince.recentContributors.length > 0
        ? focusedProvince.recentContributors.slice(0, 4)
        : [
            {
              id: `preview_${cameraFocus.provinceId}`,
              username: cameraFocus.username || 'Người Chơi',
              avatarUrl: cameraFocus.avatarUrl || null,
              avatarColor: cameraFocus.avatarColor || '#10b981',
              pointsAdded:
                cameraFocus.pointsAdded || focusedProvince?.points || 1,
              isRose: Boolean(cameraFocus.isRose),
              timestamp: Date.now(),
            },
          ];

    const byUser = new Map<string, ProvinceContributor>();
    for (const sender of rawList) {
      const key = (sender.username || 'Người Chơi').toLowerCase();
      const resolvedUrl = resolveAvatarForUsername(
        sender.username,
        sender.avatarUrl,
        npcAvatars
      );
      const prev = byUser.get(key);
      if (prev) {
        byUser.set(key, {
          ...prev,
          avatarUrl: resolvedUrl || prev.avatarUrl,
          pointsAdded: prev.pointsAdded + (sender.pointsAdded || 0),
          roseCount: (prev.roseCount || 0) + (sender.roseCount || 0),
          isRose: Boolean(prev.isRose || sender.isRose),
          timestamp: sender.timestamp || prev.timestamp,
        });
      } else {
        byUser.set(key, {
          ...sender,
          avatarUrl: resolvedUrl,
        });
      }
    }

    return Array.from(byUser.values());
  }, [cameraFocus, focusedProvince, npcAvatars]);

  // Danh sách TẤT CẢ người chơi đã gửi điểm vào tỉnh này trong suốt phiên (lưu giữ tới khi hết phiên)
  const sessionProvinceContributors = useMemo<ProvinceContributor[]>(() => {
    if (!focusedProvince) return [];
    const byUser = new Map<string, ProvinceContributor>();

    // Ưu tiên người vừa gửi trong lượt hiện tại lên trước, sau đó là toàn bộ người đã gửi trước đó trong phiên
    for (const c of activeBatchedSenders) {
      byUser.set(c.username.toLowerCase(), {
        ...c,
        avatarUrl: resolveAvatarForUsername(c.username, c.avatarUrl, npcAvatars),
      });
    }
    for (const c of focusedProvince.recentContributors) {
      const key = c.username.toLowerCase();
      if (!byUser.has(key)) {
        byUser.set(key, {
          ...c,
          avatarUrl: resolveAvatarForUsername(
            c.username,
            c.avatarUrl,
            npcAvatars
          ),
        });
      }
    }

    return Array.from(byUser.values()).slice(0, 24);
  }, [activeBatchedSenders, focusedProvince, npcAvatars]);

  const latestSender =
    activeBatchedSenders[activeBatchedSenders.length - 1] || null;

  // Danh sách icon hướng dẫn quà tặng hiển thị trên màn hình
  const visibleGuideItems = useMemo<GiftGuideItem[]>(() => {
    const items =
      Array.isArray(config.giftGuideItems) && config.giftGuideItems.length > 0
        ? config.giftGuideItems
        : DEFAULT_GIFT_GUIDE_ITEMS;
    return items.filter((item) => item.enabled);
  }, [config.giftGuideItems]);

  const howToPlay = config.howToPlayConfig || DEFAULT_HOW_TO_PLAY_CONFIG;

  const renderIconContent = (
    iconVal: string | undefined,
    fallbackEmoji: string,
    imgClassName = 'w-7 h-7 object-contain'
  ) => {
    const src = iconVal || fallbackEmoji;
    if (isImageSource(src)) {
      return (
        <img
          src={src}
          alt="gift-icon"
          referrerPolicy="no-referrer"
          className={imgClassName}
        />
      );
    }
    return <span>{src}</span>;
  };

  const internalBorderWidth = config.mapInternalBorderWidth ?? 0.65;
  const internalBorderOpacity = config.mapInternalBorderOpacity ?? 0.25;

  return (
    <div className="flex-1 h-full flex items-center justify-center bg-stone-950 p-2 overflow-hidden select-none">
      {/* Khung chuẩn 9:16 (tương đương 1080x1920 thu phóng) */}
      <div
        ref={containerRef}
        className="relative h-full max-h-full aspect-[9/16] rounded-2xl overflow-hidden border border-teal-950/80 shadow-2xl"
        style={{
          background:
            'radial-gradient(circle at 50% 48%, #10353e 0%, #0b252c 58%, #07191f 100%)',
        }}
      >
        <div
          className="relative w-[540px] h-[960px] origin-top-left overflow-hidden"
          style={{
            transform: `scale(${stageScale})`,
            transformOrigin: 'top left',
          }}
        >
          {/* Khung chỉ dẫn Vùng An Toàn Hình Vuông 540x540 chạm 2 cạnh màn hình */}
          {(config.layoutEditMode || config.showSafeSquareGuide) && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: `${SAFE_SQUARE_TOP}px`,
                width: `${SAFE_SQUARE_SIZE}px`,
                height: `${SAFE_SQUARE_SIZE}px`,
              }}
              className="z-20 pointer-events-none border-2 border-dashed border-emerald-400/70 bg-emerald-500/5 flex items-start justify-end p-2"
            >
              <span className="px-2 py-0.5 rounded bg-emerald-500 text-stone-950 text-[10px] font-black uppercase tracking-wider shadow">
                Vùng An Toàn Hình Vuông 540×540 (Chạm 2 Cạnh)
              </span>
            </div>
          )}

          {/* =====================================================================
              1. LỚP BẢN ĐỒ VIỆT NAM VECTOR NÉT CĂNG 100% Ở MỌI CẤP ZOOM (TỚI 15X)
                 - Nội suy trực tiếp trên <g ref={svgCameraGroupRef}> bằng requestAnimationFrame
                 - Multi-Stroke Vector Glow thay thế cho filter feDropShadow để không bao giờ bị mờ rồi mới rõ!
             ===================================================================== */}
          <div className="absolute inset-0">
            <svg
              width={SAFE_SQUARE_SIZE}
              height={SAFE_SQUARE_SIZE}
              viewBox={`0 0 ${SAFE_SQUARE_SIZE} ${SAFE_SQUARE_SIZE}`}
              shapeRendering="geometricPrecision"
              style={{
                position: 'absolute',
                left: 0,
                top: `${SAFE_SQUARE_TOP}px`,
                overflow: 'visible',
              }}
            >
              {/* Nhóm Camera nội suy mượt bằng requestAnimationFrame ngay trong không gian Vector */}
              <g
                ref={svgCameraGroupRef}
                transform={`translate(${targetCamera.tx.toFixed(
                  2
                )}, ${targetCamera.ty.toFixed(2)}) scale(${targetCamera.zoom.toFixed(
                  4
                )})`}
              >
                {/* Nhóm tọa độ gốc của bản đồ Việt Nam (1024 x 1535) */}
                <g
                  transform={`translate(${MAP_RENDER_OFFSET_X}, ${MAP_RENDER_OFFSET_Y}) scale(${MAP_RENDER_SCALE})`}
                >
                  {/* Chỉ hiển thị ảnh nền đường bờ biển khi ở chế độ đung đưa 1x; khi Zoom vào tỉnh hoặc rê gần Bắc-Nam sẽ thuần Vector sắc nét 100% */}
                  {!cameraFocus.provinceId &&
                    (config.mapIdleMode || 'sway') === 'sway' && (
                      <image
                        href={VIETNAM_MAP_IMAGE_URL}
                        x={0}
                        y={0}
                        width={RAW_MAP_WIDTH}
                        height={RAW_MAP_HEIGHT}
                        preserveAspectRatio="none"
                        opacity={0.88}
                      />
                    )}

                  {/* Vẽ Vector 34 tỉnh/thành phố: Độ nét vô hạn ở mọi mức phóng đại (kể cả 15x) */}
                  {provinces.map((prov) => {
                    const poly = polygonMap.get(prov.id);
                    if (!poly) return null;
                    const isFocused = cameraFocus.provinceId === prov.id;
                    const hasPoints = prov.points > 0;
                    const isTop1 =
                      top5Provinces[0]?.id === prov.id && prov.points > 0;

                    const baseCreamFill =
                      prov.code % 2 === 0 ? '#fef5cc' : '#fde89e';

                    return (
                      <g
                        key={prov.id}
                        onClick={() => onSelectProvince?.(prov.id)}
                        className="cursor-pointer"
                      >
                        {/* Lớp nền Vector tỉnh */}
                        <path
                          d={poly.rawAllPaths}
                          fill={
                            isTop1 && !isFocused
                              ? '#e3f9df'
                              : hasPoints && !isFocused
                              ? '#f3fae8'
                              : baseCreamFill
                          }
                          stroke={
                            cameraFocus.provinceId
                              ? 'rgba(13, 52, 62, 0.35)'
                              : baseCreamFill
                          }
                          strokeWidth={cameraFocus.provinceId ? 1.2 : 3.6}
                          strokeLinejoin="round"
                          opacity={
                            cameraFocus.provinceId && !isFocused ? 0.52 : 0.94
                          }
                        />

                        {/* Đường viền mỏng giữa các tỉnh */}
                        {!isFocused && (
                          <path
                            d={poly.rawAllPaths}
                            fill="none"
                            stroke={
                              isTop1
                                ? '#FF6F61'
                                : hasPoints
                                ? 'rgba(22, 138, 80, 0.5)'
                                : `rgba(181, 131, 24, ${internalBorderOpacity})`
                            }
                            strokeWidth={
                              isTop1
                                ? 2.2
                                : hasPoints
                                ? 1.2
                                : internalBorderWidth
                            }
                            strokeLinejoin="round"
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* TỈNH ĐANG ĐƯỢC CAMERA ZOOM VÀO:
                      Nền #D4F5D0 + Viền Hồng San Hô (#FF6F61) + Multi-Stroke Vector Glow (Không dùng filter bitmap!) */}
                  {focusedProvince &&
                    (() => {
                      const focusedPoly = polygonMap.get(focusedProvince.id);
                      if (!focusedPoly) return null;
                      const zoomCompensation = Math.sqrt(
                        Math.max(1, currentZoomScale / 2.6)
                      );
                      const outerGlowWidth = Math.max(
                        5,
                        22 / zoomCompensation
                      );
                      const midGlowWidth = Math.max(
                        3.2,
                        11.5 / zoomCompensation
                      );
                      const coreBorderWidth = Math.max(
                        1.6,
                        5.2 / zoomCompensation
                      );

                      return (
                        <g className="pointer-events-none">
                          {/* Lớp hào quang Vector ngoài cùng (#D4F5D0) */}
                          <path
                            d={focusedPoly.rawPrimaryPath}
                            fill="none"
                            stroke="#D4F5D0"
                            strokeWidth={outerGlowWidth}
                            strokeOpacity={0.32}
                            strokeLinejoin="round"
                          />
                          {/* Lớp hào quang Vector Hồng San Hô (#FF6F61) */}
                          <path
                            d={focusedPoly.rawPrimaryPath}
                            fill="none"
                            stroke="#FF6F61"
                            strokeWidth={midGlowWidth}
                            strokeOpacity={0.48}
                            strokeLinejoin="round"
                          />
                          {/* Thân tỉnh Vector sắc nét tuyệt đối */}
                          <path
                            d={focusedPoly.rawPrimaryPath}
                            fill="#D4F5D0"
                            stroke="#FF6F61"
                            strokeWidth={coreBorderWidth}
                            strokeLinejoin="round"
                          />
                        </g>
                      );
                    })()}
                </g>

                {/* QUẦN ĐẢO HOÀNG SA & QUẦN ĐẢO TRƯỜNG SA (VIỆT NAM) */}
                {VIETNAM_ISLAND_CLUSTERS.map((cluster) => (
                  <g key={cluster.id}>
                    {cluster.islands.map((isl, idx) => (
                      <ellipse
                        key={idx}
                        cx={isl.cx}
                        cy={isl.cy}
                        rx={isl.rx}
                        ry={isl.ry}
                        transform={`rotate(${isl.rot} ${isl.cx} ${isl.cy})`}
                        fill="#fce694"
                        stroke="rgba(181, 131, 24, 0.45)"
                        strokeWidth={0.55}
                      />
                    ))}
                    <ellipse
                      cx={cluster.centerX}
                      cy={cluster.centerY - 14}
                      rx={27}
                      ry={16}
                      fill="none"
                      stroke="#d8c374"
                      strokeWidth={0.55}
                      strokeDasharray="2.5 2.5"
                      opacity={0.65}
                    />
                    <text
                      x={cluster.centerX}
                      y={cluster.centerY + 12}
                      textAnchor="middle"
                      fill="#f1e6b8"
                      fontSize="8.5"
                      fontWeight="800"
                      letterSpacing="0.6"
                    >
                      {cluster.title}
                    </text>
                    <text
                      x={cluster.centerX}
                      y={cluster.centerY + 22}
                      textAnchor="middle"
                      fill="#b8cfd4"
                      fontSize="7"
                      fontWeight="700"
                      letterSpacing="1.1"
                    >
                      {cluster.subtitle}
                    </text>
                  </g>
                ))}

                {/* KHI CAMERA Ở CHẾ ĐỘ CHỜ CỦA MAP MẶC ĐỊNH:
                    Các tên tỉnh kèm điểm hiển thị MÀU HỒNG NHẠT (#fbcfe8) nổi bật & sang trọng */}
                {!cameraFocus.provinceId &&
                  overviewLabels.map(({ prov, poly, y, side }) => {
                    const textX =
                      side === 'left'
                        ? poly.labelLineEndX - 4
                        : poly.labelLineEndX + 4;
                    const shortName = prov.name.replace(/^TP\.\s*/i, '');
                    return (
                      <g
                        key={`lbl_${prov.id}`}
                        onClick={() => onSelectProvince?.(prov.id)}
                        className="cursor-pointer"
                      >
                        <polyline
                          points={`${poly.centerX.toFixed(
                            1
                          )},${poly.centerY.toFixed(
                            1
                          )} ${poly.labelLineEndX.toFixed(1)},${y.toFixed(1)}`}
                          fill="none"
                          stroke="#f9a8d4"
                          strokeWidth={0.85}
                          opacity={0.9}
                        />
                        <circle
                          cx={poly.centerX}
                          cy={poly.centerY}
                          r={1.8}
                          fill="#fbcfe8"
                          stroke="#FF6F61"
                          strokeWidth={0.8}
                        />
                        <text
                          x={textX}
                          y={y + 3}
                          textAnchor={side === 'left' ? 'end' : 'start'}
                          fill="#fbcfe8"
                          fontSize={config.tileFontSize || 10}
                          fontWeight="800"
                          style={{
                            paintOrder: 'stroke',
                            stroke: '#061a20',
                            strokeWidth: '2.8px',
                            strokeLinecap: 'round',
                            strokeLinejoin: 'round',
                          }}
                        >
                          {shortName} · {prov.points}
                        </text>
                      </g>
                    );
                  })}
              </g>
            </svg>

            {/* =====================================================================
                KHI CAMERA ĐANG ZOOM VÀO TỈNH (RENDER NATIVE 1:1 CRISP DOM):
                - Vòng Ngoài (z-20): Tất cả Avatar + Tên người chơi đã đóng góp trong phiên
                  nằm RẢI RÁC GẦN BIÊN GIỚI TỈNH (borderAnchors) với hiệu ứng RƠI NHANH (.province-pin-drop)
                - Vòng Trung Tâm (z-50 - Layer cao nhất, không bao giờ bị che):
                  Để trống vùng trung tâm để hiển thị:
                  + Số điểm hiện tại TO & RÕ (focusedProvince.points)
                  + Tên tỉnh
                  + Floating text số điểm vừa nhận (+pointsAdded)
                  + Icon Hoa Hồng nổ nhanh từ tâm (.province-rose-burst-item) nếu có tặng hoa!
               ===================================================================== */}
            {focusedProvince &&
              (() => {
                const poly = polygonMap.get(focusedProvince.id);
                if (!poly) return null;

                // Khi zoom vào tỉnh, tâm tỉnh luôn hội tụ về chính giữa Hình Vuông An Toàn (X = 270, Y = SAFE_SQUARE_TOP + 270 = 480)
                const centerScreenX = STAGE_WIDTH / 2;
                const centerScreenY = SAFE_SQUARE_TOP + SAFE_SQUARE_SIZE / 2;
                const shortName = focusedProvince.name.replace(/^TP\.\s*/i, '');
                const displayDelta =
                  cameraFocus.pointsAdded ||
                  latestSender?.pointsAdded ||
                  1;
                const hasRoseBurst =
                  Boolean(cameraFocus.isRose) ||
                  (cameraFocus.totalRoses || 0) > 0 ||
                  activeBatchedSenders.some((s) => s.isRose);

                // Quy đổi khoảng cách từ tâm ra biên giới tỉnh trên màn hình sao cho luôn bám sát rìa biên giới
                // và chừa trống hoàn toàn khoảng giữa (bán kính tối thiểu 68px từ tâm)
                const effectiveRadiusScale = Math.max(
                  2.4,
                  Math.min(6.2, currentZoomScale)
                );
                const anchors =
                  poly.borderAnchors && poly.borderAnchors.length > 0
                    ? poly.borderAnchors
                    : [
                        { dx: -26, dy: -22 },
                        { dx: 26, dy: -22 },
                        { dx: -28, dy: 20 },
                        { dx: 28, dy: 20 },
                      ];

                const burstKey = `${focusedProvince.id}_${
                  cameraFocus.startedAt || cameraFocus.until
                }_${displayDelta}`;

                return (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${centerScreenX}px`,
                      top: `${centerScreenY}px`,
                    }}
                    className="pointer-events-none"
                  >
                    {/* LAYER 1 (z-20): CÁC AVATAR NGƯỜI CHƠI TRONG PHIÊN NẰM RẢI RÁC GẦN BIÊN GIỚI + RƠI NHANH XUỐNG */}
                    <div className="absolute inset-0 z-20">
                      {sessionProvinceContributors.map((contrib, idx) => {
                        const anchor = anchors[idx % anchors.length];
                        let offsetX = anchor.dx * effectiveRadiusScale;
                        let offsetY = anchor.dy * effectiveRadiusScale;

                        // Đảm bảo không có avatar nào lọt vào vùng trung tâm (bán kính < 66px)
                        // và không tràn quá xa khỏi khung 540x540 (bán kính > 215px)
                        const dist = Math.hypot(offsetX, offsetY) || 1;
                        const minCenterClearance = 68 + (idx % 3) * 10;
                        const maxBorderReach = 210;
                        if (dist < minCenterClearance) {
                          const boost = minCenterClearance / dist;
                          offsetX *= boost;
                          offsetY *= boost;
                        } else if (dist > maxBorderReach) {
                          const shrink = maxBorderReach / dist;
                          offsetX *= shrink;
                          offsetY *= shrink;
                        }

                        const resolvedUrl = resolveAvatarForUsername(
                          contrib.username,
                          contrib.avatarUrl,
                          npcAvatars
                        );
                        const isJustSent = activeBatchedSenders.some(
                          (s) =>
                            s.username.toLowerCase() ===
                            contrib.username.toLowerCase()
                        );

                        return (
                          <div
                            key={`${focusedProvince.id}_${contrib.username}`}
                            style={{
                              position: 'absolute',
                              left: `${offsetX.toFixed(1)}px`,
                              top: `${offsetY.toFixed(1)}px`,
                            }}
                          >
                            <div
                              style={{
                                animationDelay: isJustSent
                                  ? '0ms'
                                  : `${Math.min(240, idx * 28)}ms`,
                              }}
                              className="province-pin-drop flex flex-col items-center"
                            >
                              <div
                                className={`rounded-full overflow-hidden shadow-lg bg-stone-900 ${
                                  isJustSent
                                    ? 'w-9 h-9 border-2 border-[#FF6F61] ring-2 ring-amber-300/80'
                                    : 'w-7 h-7 border-[1.5px] border-[#FF6F61]/90'
                                }`}
                                style={{ backgroundColor: contrib.avatarColor }}
                              >
                                <img
                                  src={resolvedUrl}
                                  alt={contrib.username}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).src =
                                      `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(
                                        contrib.username || 'Player'
                                      )}`;
                                  }}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <span
                                className="mt-0.5 px-1.5 py-0.2 rounded-full bg-[#071f26]/95 border border-[#FF6F61]/50 text-[9px] font-extrabold text-white max-w-[84px] truncate leading-tight shadow"
                                style={{
                                  textShadow: '0 1px 2px rgba(0,0,0,0.95)',
                                }}
                              >
                                {contrib.username}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* LAYER 2 (z-50 - ƯU TIÊN ĐẨY LÊN LAYER ĐẦU):
                        TRUNG TÂM TỈNH TRỐNG THOÁNG: HIỆN SỐ ĐIỂM HIỆN TẠI TO + TÊN TỈNH + FLOATING TEXT ĐIỂM NHẬN + HOA HỒNG NỔ NHANH */}
                    <div
                      key={burstKey}
                      className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center justify-center pointer-events-none"
                    >
                      {/* Hiệu ứng Hoa Hồng nổ nhanh từ tâm tỉnh nếu có gửi hoa */}
                      {hasRoseBurst && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          {ROSE_BURST_VECTORS.map((vec, i) => (
                            <div
                              key={i}
                              className="province-rose-burst-item text-xl select-none"
                              style={
                                {
                                  '--tx': vec.tx,
                                  '--ty': vec.ty,
                                  '--rot': vec.rot,
                                  animationDelay: vec.delay,
                                } as React.CSSProperties
                              }
                            >
                              {renderIconContent(
                                config.roseIconUrl,
                                '🌹',
                                'w-6 h-6 object-contain drop-shadow'
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Floating Text số điểm vừa nhận (+1, +5, +10...) kèm icon Hoa Hồng bay vọt lên */}
                      <div className="province-float-points flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FF6F61] border-2 border-white shadow-[0_4px_14px_rgba(255,111,97,0.75)] mb-1">
                        <span className="font-mono text-base font-black text-white leading-none drop-shadow">
                          +{displayDelta}
                        </span>
                        {hasRoseBurst && (
                          <span className="text-sm leading-none">
                            {renderIconContent(
                              config.roseIconUrl,
                              '🌹',
                              'w-4 h-4 object-contain'
                            )}
                          </span>
                        )}
                      </div>

                      {/* Số điểm hiện tại của tỉnh TO RÕ + Tên Tỉnh ở ngay trung tâm */}
                      <div className="px-3.5 py-1.5 rounded-2xl bg-[#072229]/92 border-2 border-[#FF6F61] shadow-[0_6px_22px_rgba(0,0,0,0.75)] flex flex-col items-center min-w-[96px]">
                        <span
                          className="font-mono text-[26px] font-black text-[#fde047] leading-none tabular-nums"
                          style={{
                            textShadow: '0 2px 6px rgba(0,0,0,0.95)',
                          }}
                        >
                          {focusedProvince.points}
                        </span>
                        <span className="mt-0.5 text-[11.5px] font-black uppercase tracking-wide text-white whitespace-nowrap">
                          {shortName}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
          </div>

          {/* =====================================================================
              2. VỊ TRÍ HIỆN AVATAR TO KHI ZOOM:
                 - Căn lề phải (right-aligned)
                 - Khi có nhiều avatar thì xếp từ phía phải qua trái (flex-row-reverse)
             ===================================================================== */}
          {isElementVisible('bigAvatarZone') &&
            (cameraFocus.provinceId || config.layoutEditMode) &&
            (activeBatchedSenders.length > 0 || config.layoutEditMode) && (
              <DraggableLayoutBox
                elementKey="bigAvatarZone"
                label="Vị trí Avatar To (Phải ➔ Trái)"
                config={config}
                scaleFactor={stageScale}
                transformOrigin="bottom right"
                onUpdateConfig={onUpdateConfig}
                baseClassName="absolute right-4 bottom-[242px] z-30 flex flex-col items-end"
              >
                <div className="flex flex-row-reverse items-center justify-start gap-4 px-1">
                  {(activeBatchedSenders.length > 0
                    ? activeBatchedSenders.slice(0, 4)
                    : [
                        {
                          id: 'demo_1',
                          username: 'Người Chơi 1',
                          avatarUrl: npcAvatars[0] || DEFAULT_NPC_AVATARS[0],
                          avatarColor: '#10b981',
                          pointsAdded: 5,
                          isRose: true,
                          timestamp: 0,
                        },
                        {
                          id: 'demo_2',
                          username: 'Người Chơi 2',
                          avatarUrl: npcAvatars[1] || DEFAULT_NPC_AVATARS[1],
                          avatarColor: '#f59e0b',
                          pointsAdded: 5,
                          isRose: true,
                          timestamp: 0,
                        },
                      ]
                  ).map((sender) => {
                    const resolvedUrl = resolveAvatarForUsername(
                      sender.username,
                      sender.avatarUrl,
                      npcAvatars
                    );
                    return (
                      <div
                        key={`${
                          cameraFocus.provinceId || 'demo'
                        }_${sender.username.toLowerCase()}`}
                        className="flex flex-col items-center province-avatar-throw"
                      >
                        <div
                          className="relative w-[80px] h-[80px] rounded-full p-[3px] shadow-[0_6px_24px_rgba(0,0,0,0.65)]"
                          style={{
                            background:
                              'linear-gradient(135deg, #f6e7a4 0%, #c8a24b 50%, #f3df8d 100%)',
                          }}
                        >
                          <div
                            className="w-full h-full rounded-full overflow-hidden border-2 border-[#102a30] flex items-center justify-center bg-stone-900"
                            style={{ backgroundColor: sender.avatarColor }}
                          >
                            <img
                              src={resolvedUrl}
                              alt={sender.username}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(
                                    sender.username || 'Player'
                                  )}`;
                              }}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {sender.pointsAdded > 0 && (
                            <span className="absolute -bottom-1 right-0 px-1.5 py-0.5 rounded-full bg-[#FF6F61] border border-white text-[10px] font-mono font-black text-white leading-none shadow">
                              +{sender.pointsAdded}đ
                            </span>
                          )}
                        </div>
                        <span
                          className="mt-1.5 text-xs font-extrabold text-white max-w-[105px] truncate text-center"
                          style={{
                            textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                          }}
                        >
                          {sender.username}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </DraggableLayoutBox>
            )}

          {/* =====================================================================
              3. BANNER BÌNH LUẬN / QUÀ VỪA GỬI
             ===================================================================== */}
          {isElementVisible('giftToastBanner') &&
            (latestSender ||
              thrownAvatars.length > 0 ||
              config.layoutEditMode) && (
              <DraggableLayoutBox
                elementKey="giftToastBanner"
                label="Banner Bình Luận & Quà"
                config={config}
                scaleFactor={stageScale}
                transformOrigin="bottom left"
                onUpdateConfig={onUpdateConfig}
                baseClassName="absolute left-4 bottom-[225px] z-30"
              >
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#091f26]/90 border border-teal-800/60 backdrop-blur-md shadow-xl">
                  <div
                    className="w-9 h-9 rounded-full overflow-hidden border border-amber-300/80 shrink-0 flex items-center justify-center bg-stone-900"
                    style={{
                      backgroundColor:
                        latestSender?.avatarColor ||
                        thrownAvatars[0]?.avatarColor ||
                        '#f59e0b',
                    }}
                  >
                    <img
                      src={resolveAvatarForUsername(
                        latestSender?.username ||
                          thrownAvatars[0]?.username ||
                          'Người Chơi',
                        latestSender?.avatarUrl || thrownAvatars[0]?.avatarUrl,
                        npcAvatars
                      )}
                      alt="sender"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          DEFAULT_NPC_AVATARS[0];
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="pr-1">
                    <div className="text-xs font-extrabold text-white max-w-[115px] truncate leading-tight">
                      {activeBatchedSenders.length > 1
                        ? `${activeBatchedSenders.length} người chơi`
                        : latestSender?.username ||
                          thrownAvatars[0]?.username ||
                          'Người chơi'}
                    </div>
                    <div className="text-[10px] text-teal-200/80 leading-tight">
                      {(cameraFocus.totalRoses || 0) > 0 ||
                      latestSender?.isRose ||
                      thrownAvatars[0]?.isRose
                        ? 'đã gửi Hoa hồng'
                        : `bình luận về ${
                            cameraFocus.provinceName || 'Hà Nội'
                          }`}
                    </div>
                  </div>
                  <div className="text-2xl leading-none flex items-center justify-center">
                    {(cameraFocus.totalRoses || 0) > 0 ||
                    latestSender?.isRose ||
                    thrownAvatars[0]?.isRose
                      ? renderIconContent(
                          config.roseIconUrl,
                          '🌹',
                          'w-6 h-6 object-contain'
                        )
                      : renderIconContent(
                          config.commentIconUrl,
                          '💖',
                          'w-6 h-6 object-contain'
                        )}
                  </div>
                  <span className="text-lg font-black italic text-white tracking-tight pr-1">
                    x
                    {Math.max(
                      1,
                      cameraFocus.totalRoses ||
                        cameraFocus.totalGifts ||
                        activeBatchedSenders.length ||
                        1
                    )}
                  </span>
                </div>
              </DraggableLayoutBox>
            )}

          {/* =====================================================================
              4. TIÊU ĐỀ VÒNG GẶP GỠ + THANH ĐANG GHÉ THĂM + NÚT GỬI LỜI CHÀO
             ===================================================================== */}
          {config.showTopHeader && (
            <>
              {/* Tiêu đề Vòng gặp gỡ */}
              {isElementVisible('headerBar') && (
                <DraggableLayoutBox
                  elementKey="headerBar"
                  label="Tiêu Đề Vòng Gặp Gỡ"
                  config={config}
                  scaleFactor={stageScale}
                  transformOrigin="top center"
                  onUpdateConfig={onUpdateConfig}
                  baseClassName="absolute top-3.5 left-3.5 right-3.5 z-30"
                >
                  <div className="h-[50px] px-4 rounded-xl bg-[#11313a]/90 border border-[#245562]/70 backdrop-blur-md flex items-center justify-between shadow-lg">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[15px] font-bold text-[#cbe0e5]">
                        {config.sessionTitle || 'Vòng gặp gỡ'}
                      </span>
                      <span className="text-xs font-semibold text-[#7da3ad]">
                        #{roundCounter}
                      </span>
                    </div>

                    <div className="font-mono text-[25px] font-black tracking-wider text-[#e4dec6] tabular-nums">
                      {formattedTimer}
                    </div>
                  </div>
                </DraggableLayoutBox>
              )}

              {/* Thanh Đang Ghé Thăm tỉnh */}
              {isElementVisible('visitingBar') &&
                (focusedProvince || config.layoutEditMode) && (
                  <DraggableLayoutBox
                    elementKey="visitingBar"
                    label="Thanh Đang Ghé Thăm"
                    config={config}
                    scaleFactor={stageScale}
                    transformOrigin="top center"
                    onUpdateConfig={onUpdateConfig}
                    baseClassName="absolute top-[92px] left-3.5 right-3.5 z-30"
                  >
                    <div className="h-[52px] px-4 rounded-xl bg-[#0e2a32]/90 border border-[#204c58]/70 backdrop-blur-md flex items-center justify-between shadow-lg">
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-[#7fa4ae]">
                          ĐANG GHÉ THĂM
                        </div>
                        <div className="text-[17px] font-extrabold text-[#D4F5D0] leading-tight">
                          {focusedProvince
                            ? focusedProvince.name.replace(/^TP\.\s*/i, '')
                            : 'Lạng Sơn'}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-[#7fa4ae]">
                          TÍCH LŨY CÁC LIVE
                        </div>
                        <div className="text-[17px] font-extrabold text-white leading-tight">
                          {stats.participantCount}{' '}
                          <span className="text-xs font-semibold text-[#9ab8c0]">
                            người
                          </span>
                        </div>
                      </div>
                    </div>
                  </DraggableLayoutBox>
                )}

              {/* Các nút Gửi lời chào / Bình luận tên tỉnh / Icon hướng dẫn quà tặng */}
              {isElementVisible('giftGuideIcons') &&
                visibleGuideItems.length > 0 && (
                  <DraggableLayoutBox
                    elementKey="giftGuideIcons"
                    label="Nút Gửi Lời Chào & Icon Quà"
                    config={config}
                    scaleFactor={stageScale}
                    transformOrigin="top center"
                    onUpdateConfig={onUpdateConfig}
                    baseClassName="absolute top-[38px] left-1/2 -translate-x-1/2 z-30"
                  >
                    <div className="flex items-start justify-center gap-6 px-2">
                      {visibleGuideItems.map((item) => {
                        const badgeCount =
                          item.statType === 'roses'
                            ? stats.totalRoses
                            : item.statType === 'comments'
                            ? stats.commentCount
                            : item.statType === 'total_gifts'
                            ? stats.totalGifts
                            : item.customBadgeText || 'Hot';

                        const effectiveIcon =
                          item.statType === 'roses' &&
                          config.roseIconUrl &&
                          config.roseIconUrl !== '🌹'
                            ? config.roseIconUrl
                            : item.statType === 'comments' &&
                              config.commentIconUrl &&
                              config.commentIconUrl !== '👑'
                            ? config.commentIconUrl
                            : item.iconUrl;

                        return (
                          <div
                            key={item.id}
                            className="flex flex-col items-center max-w-[92px]"
                          >
                            <div className="w-11 h-11 rounded-full bg-[#133842] border border-[#2e6978] shadow-md flex items-center justify-center text-2xl overflow-hidden p-1.5">
                              {renderIconContent(
                                effectiveIcon,
                                '🌹',
                                'w-full h-full object-contain'
                              )}
                            </div>
                            <span className="-mt-2 px-2 py-0.2 rounded-full bg-[#091e24] border border-[#2b606e] text-[10px] font-extrabold text-white tabular-nums">
                              {badgeCount}
                            </span>
                            <span className="mt-0.5 text-[10.5px] font-bold text-[#d5e6ea] text-center leading-tight">
                              {item.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </DraggableLayoutBox>
                )}
            </>
          )}

          {/* =====================================================================
              5. BẢNG HƯỚNG DẪN CHƠI GAME (BẢNG NỀN TỐI + CHỈNH SIZE, FONT, FONTSIZE, 5 MÀU SÁNG)
             ===================================================================== */}
          {isElementVisible('howToPlayBoard') && (
            <DraggableLayoutBox
              elementKey="howToPlayBoard"
              label="Bảng Hướng Dẫn Chơi Game"
              config={config}
              scaleFactor={stageScale}
              transformOrigin="top left"
              onUpdateConfig={onUpdateConfig}
              baseClassName="absolute left-3.5 top-[222px] z-30"
            >
              <div
                style={{
                  width: `${Math.max(150, Math.min(510, howToPlay.widthPx || 250))}px`,
                  fontFamily: howToPlay.fontFamily,
                }}
                className="p-3 rounded-xl bg-[#06161c]/92 border border-teal-700/60 backdrop-blur-md shadow-2xl space-y-1"
              >
                {howToPlay.title && (
                  <div
                    style={{
                      fontSize: `${Math.max(8, (howToPlay.fontSizePx || 11) - 1)}px`,
                      color: howToPlay.textColor || '#FDE047',
                    }}
                    className="font-black uppercase tracking-wider opacity-95 border-b border-teal-800/70 pb-1"
                  >
                    {howToPlay.title}
                  </div>
                )}
                <div
                  style={{
                    fontSize: `${howToPlay.fontSizePx || 11}px`,
                    color: howToPlay.textColor || '#FDE047',
                  }}
                  className="font-bold whitespace-pre-line leading-snug"
                >
                  {howToPlay.content}
                </div>
              </div>
            </DraggableLayoutBox>
          )}

          {/* =====================================================================
              6. CHẾ ĐỘ GỬI QUÀ THEO PHIÊN (THỜI GIAN X -> TÍNH TOP TỈNH CAO NHẤT):
                 (A) Thẻ Giờ Đếm Ngược Phiên
                 (B) Thẻ Xếp Hạng Dạng Biểu Đồ Cột Đơn Giản (Trên mỗi cột có số điểm)
             ===================================================================== */}
          {config.gamePlayMode === 'session_top5' && (
            <>
              {/* (A) Thẻ Giờ Đếm Ngược Phiên */}
              {isElementVisible('sessionTimerCard') && (
                <DraggableLayoutBox
                  elementKey="sessionTimerCard"
                  label="Thẻ Giờ Đếm Ngược Phiên"
                  config={config}
                  scaleFactor={stageScale}
                  transformOrigin="top left"
                  onUpdateConfig={onUpdateConfig}
                  baseClassName="absolute left-3.5 top-[148px] z-30"
                >
                  <div className="px-3 py-2 rounded-xl bg-[#0d2b33]/92 border border-emerald-500/50 backdrop-blur-md shadow-xl min-w-[138px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-300">
                        ⏱ {config.sessionTitle || 'Đua Top Phiên'}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-[9px] font-bold text-emerald-200">
                        #{roundCounter}
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-xl font-black text-white tracking-wider tabular-nums">
                      {formattedTimer}
                    </div>
                    <div className="mt-1 w-full h-1.5 rounded-full bg-stone-900 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-amber-300 transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, (secondsLeft / effectiveDuration) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </DraggableLayoutBox>
              )}

              {/* (B) Thẻ Xếp Hạng Dạng Biểu Đồ Cột Đơn Giản - Top 5 Tỉnh (Tăng size số điểm + tên tỉnh 1 từ 1 hàng) */}
              {isElementVisible('sessionBarChartCard') && (
                <DraggableLayoutBox
                  elementKey="sessionBarChartCard"
                  label="Biểu Đồ Cột Top 5 Tỉnh"
                  config={config}
                  scaleFactor={stageScale}
                  transformOrigin="top right"
                  onUpdateConfig={onUpdateConfig}
                  baseClassName="absolute right-3.5 top-[148px] z-30"
                >
                  <div className="p-3 rounded-xl bg-[#0d2b33]/92 border border-[#245562]/80 backdrop-blur-md shadow-xl w-[262px]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-amber-300">
                        📊 BXH Top 5 Tỉnh Phiên
                      </span>
                      <span className="text-[9px] font-semibold text-teal-200/80">
                        Top 1–5
                      </span>
                    </div>

                    {(() => {
                      const maxPts = Math.max(
                        1,
                        ...top5Provinces.map((p) => p.points)
                      );
                      const barColors = [
                        'linear-gradient(180deg, #facc15 0%, #ca8a04 100%)',
                        'linear-gradient(180deg, #34d399 0%, #059669 100%)',
                        'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)',
                        'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)',
                        'linear-gradient(180deg, #fb7185 0%, #e11d48 100%)',
                      ];

                      return (
                        <div className="grid grid-cols-5 gap-2 items-end pt-1 px-0.5">
                          {top5Provinces.map((prov, idx) => {
                            const heightPct =
                              prov.points > 0
                                ? Math.max(
                                    20,
                                    Math.round((prov.points / maxPts) * 100)
                                  )
                                : 12;
                            const shortLabel = prov.name
                              .replace(/^TP\.\s*/i, '')
                              .replace('Hồ Chí Minh', 'HCM')
                              .trim();
                            const words = shortLabel.split(/\s+/);

                            return (
                              <div
                                key={prov.id}
                                className="flex flex-col items-center justify-end"
                              >
                                {/* Số điểm to rõ phía trên cột */}
                                <span className="text-[14px] font-mono font-black text-amber-200 leading-none mb-1.5 tabular-nums drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                                  {prov.points}
                                </span>

                                {/* Cột biểu đồ */}
                                <div className="w-full h-[76px] flex items-end justify-center">
                                  <div
                                    className="w-7 rounded-t-md border border-white/30 shadow-md transition-all duration-500"
                                    style={{
                                      height: `${heightPct}%`,
                                      background:
                                        barColors[idx % barColors.length],
                                    }}
                                  />
                                </div>

                                {/* Tên tỉnh: 1 từ 1 hàng, chữ to rõ */}
                                <div className="mt-1.5 min-h-[34px] flex flex-col items-center justify-start text-[11px] font-extrabold text-white text-center leading-[1.12] tracking-tight drop-shadow">
                                  {words.map((word, wIdx) => (
                                    <span key={wIdx} className="block">
                                      {word}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </DraggableLayoutBox>
              )}
            </>
          )}

          {/* =====================================================================
              7. DANH SÁCH TỈNH ĐẠT TOP 1 NHIỀU NHẤT Ở ĐÁY MÀN HÌNH (ĐẾM SỐ LẦN TOP 1)
             ===================================================================== */}
          {isElementVisible('bottomPodium') && (
            <DraggableLayoutBox
              elementKey="bottomPodium"
              label="Danh Sách Tỉnh Đạt Top 1 Nhiều Nhất"
              config={config}
              scaleFactor={stageScale}
              transformOrigin="bottom center"
              onUpdateConfig={onUpdateConfig}
              baseClassName="absolute left-3.5 right-3.5 bottom-4 z-30"
            >
              <div className="p-3.5 rounded-2xl bg-[#0c262e]/92 border border-[#1d4955]/80 backdrop-blur-md shadow-2xl space-y-2.5">
                {/* Tiêu đề Danh sách tỉnh đạt Top 1 nhiều nhất */}
                <div className="flex items-center justify-between border-b border-teal-800/70 pb-1.5 px-1">
                  <span className="text-[11.5px] font-black uppercase tracking-wider text-amber-300 drop-shadow">
                    🏆{' '}
                    {config.podiumTitle ||
                      'DANH SÁCH TỈNH ĐẠT TOP 1 NHIỀU NHẤT'}
                  </span>
                  <span className="text-[9.5px] font-bold text-teal-200/85">
                    Đếm số lần Top 1
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3.5">
                  {[0, 1, 2].map((rankIdx) => {
                    const prov = top3MostTop1Provinces[rankIdx];
                    const rankLabel = `0${rankIdx + 1}`;
                    const winCount = prov?.top1WinCount || 0;
                    const hasAnyRecord =
                      prov && (winCount > 0 || prov.points > 0);
                    const shortName = hasAnyRecord
                      ? prov.name.replace(/^TP\.\s*/i, '')
                      : 'Chưa có';

                    const cardGradient =
                      rankIdx === 0
                        ? 'linear-gradient(180deg, #d7b46a 0%, #9b7a38 100%)'
                        : rankIdx === 1
                        ? 'linear-gradient(180deg, #a2c9c7 0%, #648c8a 100%)'
                        : 'linear-gradient(180deg, #cf9f80 0%, #8b5f44 100%)';

                    const rankColor =
                      rankIdx === 0
                        ? 'text-[#e5c168]'
                        : rankIdx === 1
                        ? 'text-[#9ecac7]'
                        : 'text-[#d6a17e]';

                    const topContributor =
                      prov?.recentContributors?.[0] || null;
                    const resolvedTopAvatar = topContributor
                      ? resolveAvatarForUsername(
                          topContributor.username,
                          topContributor.avatarUrl,
                          npcAvatars
                        )
                      : null;

                    return (
                      <div key={rankIdx} className="flex flex-col items-center">
                        <div
                          className="relative w-[108px] h-[96px] rounded-xl shadow-inner border border-white/20 flex flex-col items-center justify-center overflow-hidden px-1"
                          style={{ background: cardGradient }}
                        >
                          <span className="text-2xl font-black text-white drop-shadow leading-none">
                            {winCount}
                          </span>
                          <span className="mt-1 text-[9.5px] font-extrabold uppercase tracking-wider text-amber-100 bg-black/30 px-2 py-0.5 rounded-full">
                            lần Top 1
                          </span>
                          {prov && prov.points > 0 && (
                            <span className="mt-1 text-[9px] font-bold text-white/90">
                              Phiên này: {prov.points}đ
                            </span>
                          )}

                          <div className="absolute right-1.5 bottom-1.5 w-6 h-6 rounded-full bg-white/25 border border-white/40 overflow-hidden flex items-center justify-center">
                            {resolvedTopAvatar ? (
                              <img
                                src={resolvedTopAvatar}
                                alt={topContributor?.username || 'top'}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-2 flex items-baseline gap-1.5 max-w-full">
                          <span
                            className={`text-xs font-extrabold font-mono ${rankColor}`}
                          >
                            {rankLabel}
                          </span>
                          <span className="text-[13px] font-bold text-white truncate">
                            {shortName}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </DraggableLayoutBox>
          )}

          {/* =====================================================================
              8. LUỒNG THÔNG BÁO KẾT QUẢ PHIÊN & VINH DANH TOP 3 TỈNH + NGƯỜI TẶNG NHIỀU NHẤT
                 - Hiển thị khi hết giờ chơi của phiên
                 - Đọc xong tổng kết sẽ tự động chuyển ngay vào vòng mới (ưu tiên theo người đọc)
             ===================================================================== */}
          {sessionEndSummary && (
            <div className="absolute inset-0 z-50 bg-stone-950/85 backdrop-blur-md flex items-center justify-center p-5">
              <div className="w-full max-w-[460px] rounded-2xl bg-[#0c262e] border-2 border-amber-400/90 p-4 shadow-2xl space-y-3 text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[10px] font-black uppercase tracking-wider shadow">
                    {sessionEndSummary.sessionTitle ||
                      config.sessionTitle ||
                      'Phiên Chơi'}{' '}
                    #{sessionEndSummary.sessionNum}
                  </span>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    🏆 TỔNG KẾT TOP 3
                  </h3>
                </div>

                {/* Bục Top 3 tỉnh gọn gàng kèm tên người đóng góp nhiều nhất */}
                <div className="grid grid-cols-3 gap-2">
                  {sessionEndSummary.top3.map((prov, idx) => {
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
                    const cardStyle =
                      idx === 0
                        ? 'bg-gradient-to-b from-amber-500/30 to-amber-900/40 border-amber-400 text-amber-200'
                        : idx === 1
                        ? 'bg-gradient-to-b from-teal-500/25 to-teal-900/40 border-teal-400/70 text-teal-100'
                        : 'bg-gradient-to-b from-orange-500/25 to-stone-900/60 border-orange-400/70 text-orange-200';
                    const topUser = prov.recentContributors?.[0];

                    return (
                      <div
                        key={prov.id}
                        className={`p-2.5 rounded-xl border-2 flex flex-col items-center justify-between space-y-1 shadow-lg ${cardStyle}`}
                      >
                        <div className="text-lg leading-none">{medal}</div>
                        <div className="text-[13px] font-black text-white truncate max-w-full">
                          {prov.name.replace(/^TP\.\s*/i, '')}
                        </div>
                        <div className="px-2 py-0.5 rounded-full bg-stone-950/80 font-mono text-[11px] font-black text-amber-300">
                          {prov.points}đ
                        </div>
                        {topUser && (
                          <div className="w-full pt-1 border-t border-white/15 flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1 max-w-full">
                              <img
                                src={resolveAvatarForUsername(
                                  topUser.username,
                                  topUser.avatarUrl,
                                  npcAvatars
                                )}
                                alt={topUser.username}
                                referrerPolicy="no-referrer"
                                className="w-3.5 h-3.5 rounded-full object-cover border border-white/40 shrink-0"
                              />
                              <span className="text-[9.5px] font-extrabold text-white truncate">
                                {topUser.username}
                              </span>
                            </div>
                            <span className="text-[8.5px] font-mono font-bold text-emerald-300">
                              +{topUser.pointsAdded}đ
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {bgmNeedsUnlock && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[90] pointer-events-auto">
              <button
                type="button"
                onClick={() => soundEngine.unlockBgmPlayback()}
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs shadow-2xl border-2 border-white flex items-center gap-1.5 animate-bounce cursor-pointer"
              >
                <span>🔊 Bấm vào đây để phát Nhạc Nền Live</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

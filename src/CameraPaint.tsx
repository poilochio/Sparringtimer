import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Crosshair,
  Trash2,
  Undo2,
  SwitchCamera,
  Download,
  Share2,
  X,
  ZoomIn,
  AlertTriangle,
} from 'lucide-react';

// A single droplet that makes up a paint splatter. Offsets/radii are in
// container CSS pixels at cssZoom = 1 so the same data drives both the live
// SVG overlay and the captured-photo canvas.
interface Drop {
  dx: number;
  dy: number;
  r: number;
}

// A paint mark placed on the scene. Position is stored as a percentage of the
// video container so it stays put when the layout or capture size changes.
interface Mark {
  id: number;
  xPct: number;
  yPct: number;
  color: string;
  drops: Drop[];
}

const PAINT_COLOR = '#e11d2a';
const MAX_ZOOM = 8;

// Build a randomized paint-splatter: one fat central blob plus a scatter of
// smaller satellite droplets, so every mark looks a little different.
function makeSplatter(): Drop[] {
  const drops: Drop[] = [];
  // Central blob.
  drops.push({ dx: 0, dy: 0, r: 26 + Math.random() * 10 });
  // A couple of medium globs hugging the center.
  const mediumCount = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < mediumCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 10 + Math.random() * 16;
    drops.push({
      dx: Math.cos(a) * d,
      dy: Math.sin(a) * d,
      r: 10 + Math.random() * 10,
    });
  }
  // Scattered fine droplets flung outward.
  const fineCount = 7 + Math.floor(Math.random() * 7);
  for (let i = 0; i < fineCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 22 + Math.random() * 40;
    drops.push({
      dx: Math.cos(a) * d,
      dy: Math.sin(a) * d,
      r: 1.5 + Math.random() * 5,
    });
  }
  return drops;
}

function splatterBounds(drops: Drop[]): { min: number; max: number; size: number } {
  let max = 0;
  for (const d of drops) {
    max = Math.max(max, Math.abs(d.dx) + d.r, Math.abs(d.dy) + d.r);
  }
  const pad = max + 4;
  return { min: -pad, max: pad, size: pad * 2 };
}

export default function CameraPaint() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');

  const [zoom, setZoom] = useState(1);
  // Portion of the zoom handled in CSS (the camera can natively do the rest).
  const cssZoomRef = useRef(1);
  const [cssZoom, setCssZoom] = useState(1);
  const nativeZoomRef = useRef<{ min: number; max: number; step: number } | null>(null);

  const [marks, setMarks] = useState<Mark[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // (Re)start the camera stream for the current facing mode.
  const startCamera = useCallback(async () => {
    setError(null);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Detect native zoom support so the slider can drive real optical/digital
      // camera zoom where the device exposes it.
      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        zoom?: { min: number; max: number; step: number };
      };
      nativeZoomRef.current = caps.zoom
        ? { min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 }
        : null;

      setStarted(true);
      setZoom(1);
      cssZoomRef.current = 1;
      setCssZoom(1);
    } catch (e) {
      const err = e as DOMException;
      if (err.name === 'NotAllowedError') {
        setError('Camera permission was denied. Allow camera access and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera was found on this device.');
      } else {
        setError(`Could not start the camera: ${err.message || err.name}`);
      }
    }
  }, [facing, stopStream]);

  // Re-init when the camera is on and the user flips front/back.
  useEffect(() => {
    if (started) startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  useEffect(() => () => stopStream(), [stopStream]);

  // Split a requested zoom between the camera's native zoom and a CSS scale so
  // it works on every device, capped at MAX_ZOOM.
  const applyZoom = useCallback((next: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, next));
    setZoom(z);

    const nat = nativeZoomRef.current;
    const track = streamRef.current?.getVideoTracks()[0];
    let nativeApplied = 1;
    if (nat && track) {
      nativeApplied = Math.min(nat.max, Math.max(nat.min, z));
      track
        .applyConstraints({ advanced: [{ zoom: nativeApplied } as MediaTrackConstraintSet] })
        .catch(() => {});
    }
    const css = z / nativeApplied;
    cssZoomRef.current = css;
    setCssZoom(css);
  }, []);

  // Place a paint mark at the given container-relative percentages.
  const placeMark = useCallback((xPct: number, yPct: number) => {
    setMarks((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), xPct, yPct, color: PAINT_COLOR, drops: makeSplatter() },
    ]);
  }, []);

  // The big button marks dead center (where the crosshair aims).
  const markCenter = useCallback(() => placeMark(50, 50), [placeMark]);

  // Tapping the scene marks exactly where you touched.
  const onSceneClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      placeMark(
        ((e.clientX - rect.left) / rect.width) * 100,
        ((e.clientY - rect.top) / rect.height) * 100
      );
    },
    [placeMark]
  );

  const undo = useCallback(() => setMarks((prev) => prev.slice(0, -1)), []);
  const clearAll = useCallback(() => setMarks([]), []);

  // --- Pinch to zoom ---------------------------------------------------------
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const touchDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) pinchRef.current = { dist: touchDist(e.touches), zoom };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const ratio = touchDist(e.touches) / pinchRef.current.dist;
      applyZoom(pinchRef.current.zoom * ratio);
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
  };

  // --- Capture a composited photo -------------------------------------------
  const capture = useCallback(() => {
    const video = videoRef.current;
    const el = containerRef.current;
    if (!video || !el || !video.videoWidth) return;

    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const quality = Math.min(2, window.devicePixelRatio || 1);
    const canvas = document.createElement('canvas');
    canvas.width = cw * quality;
    canvas.height = ch * quality;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(quality, quality);

    // Reproduce object-fit: cover plus the CSS zoom, mirrored for the selfie cam.
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.max(cw / vw, ch / vh) * cssZoomRef.current;
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.save();
    if (facing === 'user') {
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    ctx.restore();

    // Paint the splatters on top, matching the on-screen positions exactly.
    for (const m of marks) {
      const cx = (m.xPct / 100) * cw;
      const cy = (m.yPct / 100) * ch;
      ctx.fillStyle = m.color;
      for (const d of m.drops) {
        ctx.beginPath();
        ctx.arc(cx + d.dx, cy + d.dy, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    setPhoto(canvas.toDataURL('image/jpeg', 0.92));
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
  }, [marks, facing]);

  const download = useCallback(() => {
    if (!photo) return;
    const a = document.createElement('a');
    a.href = photo;
    a.download = `paint-mark-${Date.now()}.jpg`;
    a.click();
  }, [photo]);

  const share = useCallback(async () => {
    if (!photo) return;
    try {
      const blob = await (await fetch(photo)).blob();
      const file = new File([blob], `paint-mark-${Date.now()}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Paint Marker' });
      } else {
        download();
      }
    } catch {
      /* user cancelled share */
    }
  }, [photo, download]);

  // --- Start screen ----------------------------------------------------------
  if (!started) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center px-6 text-center">
        <div className="relative mb-6">
          <Camera size={72} className="text-white" />
          <span className="absolute -right-3 -top-2 h-7 w-7 rounded-full bg-red-600 shadow-lg shadow-red-600/50" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Paint Marker</h1>
        <p className="text-neutral-400 max-w-sm mb-8">
          Open your camera, zoom in on someone, and tag them with a splat of red paint. Snap a photo
          to save the result.
        </p>
        <button
          onClick={startCamera}
          className="bg-red-600 hover:bg-red-500 active:bg-red-700 transition-colors px-8 py-4 rounded-full font-semibold text-lg flex items-center gap-3 shadow-lg shadow-red-600/30"
        >
          <Camera size={24} />
          Open Camera
        </button>
        {error && (
          <div className="mt-6 max-w-sm flex items-start gap-2 text-red-400 text-sm">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <p className="mt-8 text-xs text-neutral-600 max-w-xs">
          The camera only works over HTTPS (or localhost) and needs your permission.
        </p>
      </div>
    );
  }

  // --- Live camera view ------------------------------------------------------
  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      {/* Camera feed + paint overlay */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        onClick={onSceneClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{
            transform: `scale(${cssZoom})${facing === 'user' ? ' scaleX(-1)' : ''}`,
            transformOrigin: 'center',
          }}
        />

        {/* Paint marks */}
        {marks.map((m) => {
          const b = splatterBounds(m.drops);
          return (
            <svg
              key={m.id}
              className="pointer-events-none absolute"
              style={{
                left: `${m.xPct}%`,
                top: `${m.yPct}%`,
                width: b.size,
                height: b.size,
                transform: 'translate(-50%, -50%)',
              }}
              viewBox={`${b.min} ${b.min} ${b.size} ${b.size}`}
            >
              {m.drops.map((d, i) => (
                <circle key={i} cx={d.dx} cy={d.dy} r={d.r} fill={m.color} />
              ))}
            </svg>
          );
        })}
      </div>

      {/* Center crosshair */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <Crosshair size={56} className="text-white/70 drop-shadow" strokeWidth={1.5} />
      </div>

      {/* Capture flash */}
      {flash && <div className="pointer-events-none absolute inset-0 bg-white animate-pulse" />}

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
        <span className="font-semibold tracking-wide text-white/90 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-600" />
          Paint Marker
        </span>
        <button
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          className="p-2 rounded-full bg-white/10 backdrop-blur active:bg-white/20"
          aria-label="Switch camera"
        >
          <SwitchCamera size={22} className="text-white" />
        </button>
      </div>

      {/* Zoom slider */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
        <ZoomIn size={18} className="text-white/80" />
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.1}
          value={zoom}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => applyZoom(parseFloat(e.target.value))}
          className="h-40 accent-red-600 cursor-pointer"
          style={{ writingMode: 'vertical-lr', direction: 'rtl' } as React.CSSProperties}
          aria-label="Zoom"
        />
        <span className="text-xs font-medium text-white/80 tabular-nums">{zoom.toFixed(1)}×</span>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 inset-x-0 pb-8 pt-10 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center justify-center gap-8">
          {/* Undo */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              undo();
            }}
            disabled={marks.length === 0}
            className="flex flex-col items-center gap-1 text-white/90 disabled:opacity-30"
            aria-label="Undo last mark"
          >
            <span className="p-3 rounded-full bg-white/10 backdrop-blur active:bg-white/20">
              <Undo2 size={24} />
            </span>
            <span className="text-[11px]">Undo</span>
          </button>

          {/* Mark with red paint */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              markCenter();
            }}
            className="relative flex items-center justify-center"
            aria-label="Mark with red paint"
          >
            <span className="h-20 w-20 rounded-full bg-red-600 active:bg-red-700 shadow-lg shadow-red-600/40 ring-4 ring-white/80 flex items-center justify-center">
              <span className="h-12 w-12 rounded-full bg-red-500" />
            </span>
          </button>

          {/* Capture photo */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              capture();
            }}
            className="flex flex-col items-center gap-1 text-white/90"
            aria-label="Capture photo"
          >
            <span className="p-3 rounded-full bg-white/10 backdrop-blur active:bg-white/20">
              <Camera size={24} />
            </span>
            <span className="text-[11px]">Capture</span>
          </button>
        </div>

        {marks.length > 0 && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
              className="flex items-center gap-1.5 text-white/70 text-sm active:text-white"
            >
              <Trash2 size={16} />
              Clear all ({marks.length})
            </button>
          </div>
        )}
      </div>

      {/* Captured photo preview */}
      {photo && (
        <div className="absolute inset-0 z-10 bg-black/95 flex flex-col">
          <div className="flex justify-end p-4">
            <button
              onClick={() => setPhoto(null)}
              className="p-2 rounded-full bg-white/10 active:bg-white/20"
              aria-label="Close preview"
            >
              <X size={24} className="text-white" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 min-h-0">
            <img src={photo} alt="Captured" className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
          <div className="flex items-center justify-center gap-4 p-6">
            <button
              onClick={share}
              className="flex items-center gap-2 bg-white/10 active:bg-white/20 px-6 py-3 rounded-full font-semibold text-white"
            >
              <Share2 size={20} /> Share
            </button>
            <button
              onClick={download}
              className="flex items-center gap-2 bg-red-600 active:bg-red-700 px-6 py-3 rounded-full font-semibold text-white"
            >
              <Download size={20} /> Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

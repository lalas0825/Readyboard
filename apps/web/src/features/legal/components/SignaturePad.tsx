'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

// ─── Types ──────────────────────────────────────────

type Point = [number, number];
type Stroke = Point[];

export type SignatureMetadata = {
  capturedAt: string;
  deviceInfo: string;
  canvasWidth: number;
  canvasHeight: number;
  strokeCount: number;
  totalPoints: number;
  /** Full coordinate path per stroke — audit trail */
  coordPath: Stroke[];
};

export type SignatureData = {
  /** PNG image as base64 data URL */
  imageBase64: string;
  /** Audit metadata — never log to console or send to third parties */
  metadata: SignatureMetadata;
};

type SignaturePadProps = {
  onSign: (data: SignatureData) => void;
  onCancel: () => void;
  disabled?: boolean;
};

// ─── Constants ──────────────────────────────────────

const STROKE_COLOR = '#111827';
const STROKE_WIDTH = 3;
const CANVAS_BG = '#ffffff';
const MIN_POINTS = 20; // Minimum coordinate points for valid signature
const CANVAS_HEIGHT = 200;

// ─── Component ──────────────────────────────────────

export function SignaturePad({ onSign, onCancel, disabled = false }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStroke = useRef<Stroke>([]);
  const [totalPoints, setTotalPoints] = useState(0);

  const isValid = totalPoints >= MIN_POINTS;

  // ─── Canvas Setup ───────────────────────────────

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, rect.width, CANVAS_HEIGHT);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = STROKE_WIDTH;
  }, []);

  useEffect(() => {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, [setupCanvas]);

  // ─── Redraw all strokes (after resize or clear) ─

  const redrawStrokes = useCallback((allStrokes: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;

    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, w, CANVAS_HEIGHT);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = STROKE_WIDTH;

    for (const stroke of allStrokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0][0], stroke[0][1]);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i][0], stroke[i][1]);
      }
      ctx.stroke();
    }
  }, []);

  // ─── Pointer Coordinates ────────────────────────

  const getCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }, []);

  // ─── Drawing Handlers ──────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    isDrawing.current = true;

    const point = getCoords(e);
    currentStroke.current = [point];

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(point[0], point[1]);
  }, [disabled, getCoords]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || disabled) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const point = getCoords(e);
    currentStroke.current.push(point);

    ctx.lineTo(point[0], point[1]);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(point[0], point[1]);
  }, [disabled, getCoords]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    isDrawing.current = false;

    const stroke = [...currentStroke.current];
    if (stroke.length > 0) {
      setStrokes((prev) => [...prev, stroke]);
      setTotalPoints((prev) => prev + stroke.length);
    }
    currentStroke.current = [];
  }, []);

  // ─── Actions ────────────────────────────────────

  const handleClear = useCallback(() => {
    setStrokes([]);
    setTotalPoints(0);
    currentStroke.current = [];
    redrawStrokes([]);
  }, [redrawStrokes]);

  const handleSave = useCallback(() => {
    if (!isValid || disabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageBase64 = canvas.toDataURL('image/png');

    const metadata: SignatureMetadata = {
      capturedAt: new Date().toISOString(),
      deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      strokeCount: strokes.length,
      totalPoints,
      coordPath: strokes,
    };

    onSign({ imageBase64, metadata });
  }, [isValid, disabled, strokes, totalPoints, onSign]);

  // ─── Render ─────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Canvas container */}
      <div ref={containerRef} className="relative w-full">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className={`w-full rounded-lg border-2 ${
            isValid
              ? 'border-green-700/50'
              : totalPoints > 0
                ? 'border-amber-700/50'
                : 'border-zinc-600'
          } cursor-crosshair`}
          style={{
            height: CANVAS_HEIGHT,
            touchAction: 'none', // Prevent scroll during signing
          }}
        />

        {/* Placeholder text — visible only when empty */}
        {totalPoints === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-light text-zinc-300 select-none">
              Sign here
            </span>
          </div>
        )}

        {/* Signature line */}
        <div className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-dashed border-zinc-300" />
      </div>

      {/* Status indicator */}
      <div className="flex items-center justify-between text-xs">
        <span className={isValid ? 'text-green-400' : 'text-zinc-500'}>
          {totalPoints === 0
            ? 'Draw your signature above'
            : isValid
              ? 'Signature captured'
              : `Keep signing (${totalPoints}/${MIN_POINTS} points)`}
        </span>
        {totalPoints > 0 && (
          <span className="text-zinc-600">
            {strokes.length} stroke{strokes.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Action buttons — 56px height per Carlos Standard */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-zinc-700 px-4 py-3.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
          style={{ minHeight: 56 }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={totalPoints === 0}
          className="rounded-lg border border-zinc-700 px-4 py-3.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 disabled:opacity-30"
          style={{ minHeight: 56 }}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid || disabled}
          className={`flex-1 rounded-lg border px-4 py-3.5 text-sm font-semibold transition-colors ${
            isValid
              ? 'border-green-700 bg-green-950/50 text-green-400 hover:bg-green-950'
              : 'border-zinc-700 bg-zinc-800 text-zinc-600'
          } disabled:opacity-40`}
          style={{ minHeight: 56 }}
        >
          {disabled ? 'Saving...' : 'Confirm Signature'}
        </button>
      </div>
    </div>
  );
}

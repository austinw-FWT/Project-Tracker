import { useState, useRef, useEffect } from "react";
import { Pencil, Eraser, Type, Image as ImageIcon, Trash2, X, Check, MousePointer2, Undo2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Plus, Minus, ZoomIn } from "lucide-react";
import { storage, storageRef, uploadBytes, getDownloadURL } from "./firebase.js";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/**
 * SiteWalkCanvas — Freehand drawing + photo + text notes, stylus and touch friendly.
 *
 * Mobile-first redesign:
 *  - Bottom toolbar (thumb-friendly), labeled buttons, ≥48px tap targets
 *  - Bottom sheets for color & size & text formatting (no fiddly dropdowns)
 *  - Full-screen canvas; pinch-zoom + two-finger pan
 *  - Drawing locked behind explicit tool selection so you can scroll the page normally
 *
 * Data model (stored as siteWalk.canvas on the opportunity):
 * {
 *   width, height,           // logical canvas size
 *   strokes: [               // freehand strokes
 *     { id, color, size, points: [{x,y,p?}] }
 *   ],
 *   images: [                // positioned images
 *     { id, url, x, y, w, h }
 *   ],
 *   textBoxes: [             // positioned text
 *     { id, text, x, y, w, h?, size, color,
 *       bold?, italic?, underline?, align?, fontFamily? }
 *   ]
 * }
 */
export default function SiteWalkCanvas({ walkId, walkTitle, canvas, onSave, onClose, uploadPathPrefix }) {
  const CANVAS_W = 1400;
  const CANVAS_H = 2000;

  const [tool, setTool] = useState("select"); // select | pen | eraser | text
  const [color, setColor] = useState("#1f2937");
  const [size, setSize] = useState(3);
  const [strokes, setStrokes] = useState(canvas?.strokes || []);
  const [images, setImages] = useState(canvas?.images || []);
  const [textBoxes, setTextBoxes] = useState(canvas?.textBoxes || []);
  const [currentStroke, setCurrentStroke] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null); // id of text block currently in edit mode
  const [dragState, setDragState] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeSheet, setActiveSheet] = useState(null); // 'color' | 'size' | 'textFormat' | null
  const [zoom, setZoom] = useState(1);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 900);

  const svgRef = useRef(null);
  const fileRef = useRef(null);
  const saveTimer = useRef(null);
  const pinchRef = useRef(null); // tracks two-finger pinch state

  // Curated palette: dark (default for white canvas), then bright markers
  const PEN_COLORS = [
    { hex: "#1f2937", name: "Black" },
    { hex: "#dc2626", name: "Red" },
    { hex: "#ea580c", name: "Orange" },
    { hex: "#ca8a04", name: "Yellow" },
    { hex: "#16a34a", name: "Green" },
    { hex: "#2563eb", name: "Blue" },
    { hex: "#7c3aed", name: "Purple" },
    { hex: "#db2777", name: "Pink" },
  ];
  const PEN_SIZES = [
    { v: 2, label: "Fine" },
    { v: 4, label: "Medium" },
    { v: 7, label: "Thick" },
    { v: 12, label: "Marker" },
  ];

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Debounced auto-save whenever canvas state changes
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onSave({ width: CANVAS_W, height: CANVAS_H, strokes, images, textBoxes });
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [strokes, images, textBoxes]);

  // Convert pointer coords → SVG coords
  function getSvgPoint(e) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scale = CANVAS_W / rect.width;
    return {
      x: (e.clientX - rect.left) * scale,
      y: (e.clientY - rect.top) * scale,
      p: e.pressure || 0.5,
    };
  }

  // ── Drawing handlers ──
  // Track active touch points for pinch-zoom
  const activePointers = useRef(new Map());

  function handlePointerDown(e) {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-finger pinch starts: don't draw, just record
    if (activePointers.current.size === 2) {
      const pts = [...activePointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchRef.current = { startDist: dist, startZoom: zoom };
      // If we started a stroke, abandon it
      setCurrentStroke(null);
      return;
    }

    if (tool === "select") return;
    e.preventDefault();
    e.target.setPointerCapture?.(e.pointerId);

    const pt = getSvgPoint(e);
    if (tool === "pen") {
      setCurrentStroke({ id: genId(), color, size, points: [pt] });
    } else if (tool === "eraser") {
      eraseAt(pt);
    } else if (tool === "text") {
      // OneNote-style: tap anywhere, cursor appears, start typing.
      // No fixed width/height — text wraps at the canvas edge and grows with content.
      const id = genId();
      setTextBoxes([...textBoxes, {
        id, text: "", x: pt.x, y: pt.y,
        size: 22, color: "#000000",
        bold: false, italic: false, underline: false,
        align: "left", fontFamily: "'DM Sans',sans-serif",
      }]);
      setSelectedItem({ type: "text", id });
      setEditingTextId(id);
      // Stay in text tool so user can keep adding text blocks
    }
  }

  function handlePointerMove(e) {
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Pinch-zoom in progress
    if (pinchRef.current && activePointers.current.size === 2) {
      const pts = [...activePointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = dist / pinchRef.current.startDist;
      const next = Math.max(0.5, Math.min(3, pinchRef.current.startZoom * ratio));
      setZoom(next);
      return;
    }

    if (tool === "pen" && currentStroke) {
      const pt = getSvgPoint(e);
      setCurrentStroke(cs => cs ? { ...cs, points: [...cs.points, pt] } : cs);
    } else if (tool === "eraser" && e.buttons > 0) {
      eraseAt(getSvgPoint(e));
    }
  }

  function handlePointerUp(e) {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchRef.current = null;

    if (currentStroke && currentStroke.points.length > 1) {
      setStrokes(s => [...s, currentStroke]);
    }
    setCurrentStroke(null);
  }

  function eraseAt(pt) {
    const ERASE_R = 28;
    setStrokes(prev => prev.filter(stroke => {
      return !stroke.points.some(p => {
        const dx = p.x - pt.x, dy = p.y - pt.y;
        return (dx * dx + dy * dy) < ERASE_R * ERASE_R;
      });
    }));
  }

  // ── Image upload ──
  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `${uploadPathPrefix}/${walkId}/${Date.now()}_${file.name}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      const img = new Image();
      img.onload = () => {
        const maxW = 600;
        const ratio = img.height / img.width;
        const w = Math.min(img.width, maxW);
        const h = w * ratio;
        setImages(prev => [...prev, { id: genId(), url, x: 100, y: 100, w, h }]);
      };
      img.src = url;
    } catch (err) {
      console.error("Image upload failed:", err);
      alert("Upload failed: " + err.message + "\n\nCheck Firebase Storage rules.");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Item manipulation ──
  function startDrag(e, type, id, mode = "move") {
    if (tool !== "select") return;
    e.stopPropagation();
    const pt = getSvgPoint(e);
    const orig = type === "image" ? images.find(i => i.id === id) : textBoxes.find(t => t.id === id);
    if (!orig) return;
    setDragState({ type, id, mode, ox: pt.x, oy: pt.y, orig: { ...orig } });
    setSelectedItem({ type, id });
  }

  // For text blocks: pointer-down starts a "drag-or-tap" state. If the pointer moves
  // more than ~6px before release, it becomes a move-drag. Otherwise on release it
  // enters edit mode at that text block. This is what lets you tap to edit OR
  // touch-and-drag to move, without separate handles.
  function startDragOrTap(e, type, id) {
    if (tool === "text" && type === "text") {
      // Text tool + tap on existing text block → enter edit mode for that block
      e.stopPropagation();
      setSelectedItem({ type, id });
      setEditingTextId(id);
      return;
    }
    if (tool !== "select") return;
    e.stopPropagation();
    const pt = getSvgPoint(e);
    const orig = type === "text" ? textBoxes.find(t => t.id === id) : null;
    if (!orig) return;
    setDragState({
      type, id, mode: "move",
      ox: pt.x, oy: pt.y,
      orig: { ...orig },
      pendingTap: true,           // if released without movement → edit mode
      tapStartX: e.clientX,
      tapStartY: e.clientY,
    });
    setSelectedItem({ type, id });
    e.target.setPointerCapture?.(e.pointerId);
  }

  function handleCanvasPointerMove(e) {
    handlePointerMove(e);
    if (!dragState) return;
    const pt = getSvgPoint(e);
    const dx = pt.x - dragState.ox, dy = pt.y - dragState.oy;

    // If this drag started as a "drag-or-tap" on text, see if we've moved enough
    // to commit to dragging. The 6px threshold is in screen pixels, not canvas units.
    if (dragState.pendingTap) {
      const moveDistScreen = Math.hypot(e.clientX - dragState.tapStartX, e.clientY - dragState.tapStartY);
      if (moveDistScreen < 6) return; // still ambiguous — wait
      // Commit to drag
      setDragState(prev => prev ? { ...prev, pendingTap: false } : prev);
    }

    if (dragState.type === "image") {
      setImages(prev => prev.map(i => i.id !== dragState.id ? i : (
        dragState.mode === "move"
          ? { ...i, x: dragState.orig.x + dx, y: dragState.orig.y + dy }
          : { ...i, w: Math.max(60, dragState.orig.w + dx), h: Math.max(40, dragState.orig.h + dy) }
      )));
    } else if (dragState.type === "text") {
      setTextBoxes(prev => prev.map(t => t.id !== dragState.id ? t : (
        { ...t, x: dragState.orig.x + dx, y: dragState.orig.y + dy }
      )));
    }
  }

  function handleCanvasPointerUp(e) {
    handlePointerUp(e);
    // If this was a drag-or-tap that never crossed the movement threshold, treat as a tap → edit mode
    if (dragState && dragState.pendingTap && dragState.type === "text") {
      setEditingTextId(dragState.id);
    }
    setDragState(null);
  }

  function updateText(id, updates) {
    setTextBoxes(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }

  function deleteSelected() {
    if (!selectedItem) return;
    if (selectedItem.type === "image") setImages(prev => prev.filter(i => i.id !== selectedItem.id));
    else if (selectedItem.type === "text") setTextBoxes(prev => prev.filter(t => t.id !== selectedItem.id));
    setSelectedItem(null); setEditingTextId(null);
    setActiveSheet(null);
  }

  function undoLast() {
    if (strokes.length > 0) setStrokes(s => s.slice(0, -1));
  }

  function clearAll() {
    if (!confirm("Clear entire canvas? This cannot be undone.")) return;
    setStrokes([]); setImages([]); setTextBoxes([]); setSelectedItem(null); setEditingTextId(null);
  }

  // Convert a stroke's points to SVG path
  function strokeToPath(stroke) {
    if (!stroke.points.length) return "";
    const pts = stroke.points;
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    }
    return d;
  }

  const cursorStyle = tool === "pen" ? "crosshair" : tool === "eraser" ? "cell" : tool === "text" ? "text" : "default";
  const selectedTextBox = selectedItem?.type === "text" ? textBoxes.find(t => t.id === selectedItem.id) : null;

  // ── Reusable sub-components ──

  // Bottom-toolbar tool button (large, labeled, thumb-friendly)
  const ToolButton = ({ id, Icon, label, onClick, active, disabled, danger, accent }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 2,
        minWidth: isMobile ? 60 : 70, height: isMobile ? 56 : 60,
        padding: "6px 8px",
        borderRadius: 10,
        border: active ? `2px solid ${accent || "#6366f1"}` : "1px solid #1e293b",
        background: active ? (accent || "#6366f1") + "22" : "#1a2332",
        color: disabled ? "#334155" : (active ? (accent || "#818cf8") : (danger ? "#ef4444" : "#cbd5e1")),
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
        fontSize: 11,
        fontWeight: 600,
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.1s",
      }}
    >
      <Icon size={isMobile ? 22 : 20} />
      <span>{label}</span>
    </button>
  );

  // Bottom sheet wrapper
  const BottomSheet = ({ title, children, onClose: closeSheet }) => (
    <>
      <div
        onClick={closeSheet}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200 }}
      />
      <div
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0,
          background: "#1a2332", borderTop: "1px solid #334155",
          borderRadius: "16px 16px 0 0",
          padding: 16,
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          zIndex: 201,
          maxHeight: "70vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{title}</div>
          <button onClick={closeSheet} style={{ width: 36, height: 36, borderRadius: 8, border: "none", background: "#0f1729", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0f1729", zIndex: 100, display: "flex", flexDirection: "column", overscrollBehavior: "contain" }}>
      {/* ─── HEADER ─── */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 10, background: "#0b1120", flexShrink: 0 }}>
        <button onClick={onClose} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "10px 14px", borderRadius: 8,
          background: "#1a2332", border: "1px solid #1e293b",
          color: "#cbd5e1", cursor: "pointer", fontFamily: "inherit",
          fontSize: 14, fontWeight: 600,
          minHeight: 44,
        }}>
          <Check size={18} /> Done
        </button>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          📝 {walkTitle || "Notes"}
        </div>
        <span style={{ fontSize: 11, color: "#10b981", whiteSpace: "nowrap" }}>✓ Auto-saving</span>
      </div>

      {/* ─── CANVAS AREA ─── */}
      <div
        style={{ flex: 1, overflow: "auto", padding: isMobile ? 8 : 16, background: "#0f1729", WebkitOverflowScrolling: "touch" }}
        onClick={() => { if (tool === "select") { setSelectedItem(null); setEditingTextId(null); } }}
      >
        <div style={{ width: "100%", maxWidth: 1200, margin: "0 auto", transform: `scale(${zoom})`, transformOrigin: "top center", transition: dragState || currentStroke ? "none" : "transform 0.15s" }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            style={{
              width: "100%", height: "auto", background: "#fafafa",
              borderRadius: 8, boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
              cursor: cursorStyle,
              touchAction: tool === "select" ? "auto" : "none",
              display: "block",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
          >
            {/* Subtle grid background */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e5e5" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />

            {/* Images */}
            {images.map(img => {
              const isSelected = selectedItem?.type === "image" && selectedItem.id === img.id;
              return (
                <g key={img.id}>
                  <image
                    href={img.url}
                    x={img.x} y={img.y} width={img.w} height={img.h}
                    onPointerDown={e => startDrag(e, "image", img.id, "move")}
                    style={{ cursor: tool === "select" ? "move" : cursorStyle }}
                  />
                  {isSelected && (
                    <>
                      <rect x={img.x - 2} y={img.y - 2} width={img.w + 4} height={img.h + 4} fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="4 4" pointerEvents="none" />
                      <rect x={img.x + img.w - 12} y={img.y + img.h - 12} width={24} height={24} fill="#6366f1" stroke="#fff" strokeWidth="2"
                        onPointerDown={e => startDrag(e, "image", img.id, "resize")}
                        style={{ cursor: "nwse-resize" }}
                      />
                    </>
                  )}
                </g>
              );
            })}

            {/* Strokes */}
            {strokes.map(stroke => (
              <path key={stroke.id} d={strokeToPath(stroke)}
                fill="none" stroke={stroke.color} strokeWidth={stroke.size}
                strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
            ))}
            {currentStroke && (
              <path d={strokeToPath(currentStroke)}
                fill="none" stroke={currentStroke.color} strokeWidth={currentStroke.size}
                strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
            )}

            {/* Text boxes */}
            {/* Text blocks — OneNote style. No fixed width/height; auto-sized to content.
                In edit mode, shows a textarea; otherwise shows the rendered text.
                In Select tool: tap-without-drag re-enters edit mode at that block; tap-and-drag moves it. */}
            {textBoxes.map(tb => {
              const isSelected = selectedItem?.type === "text" && selectedItem.id === tb.id;
              const isEditing = editingTextId === tb.id;
              // Width: from text origin to right edge of canvas, capped reasonable max
              const availW = Math.min(CANVAS_W - tb.x - 20, 900);
              const baseStyle = {
                color: tb.color,
                fontSize: tb.size,
                fontFamily: tb.fontFamily || "'DM Sans',sans-serif",
                fontWeight: tb.bold ? 700 : 400,
                fontStyle: tb.italic ? "italic" : "normal",
                textDecoration: tb.underline ? "underline" : "none",
                textAlign: tb.align || "left",
                lineHeight: 1.3,
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
                overflowWrap: "break-word",
              };
              // Height estimate from line count for the foreignObject viewport.
              // Real DOM auto-sizes inside, but the foreignObject needs fixed dims.
              const textForMeasure = tb.text || (isEditing ? " " : "Tap to edit");
              const lineCount = Math.max(1, textForMeasure.split("\n").length);
              const estLines = Math.ceil(textForMeasure.length / Math.max(20, availW / (tb.size * 0.55))) + lineCount;
              const estH = Math.max(tb.size * 1.4 + 20, estLines * tb.size * 1.4 + 20);
              return (
                <g key={tb.id}>
                  <foreignObject x={tb.x} y={tb.y} width={availW + 8} height={estH + 8} style={{ overflow: "visible" }}>
                    {isEditing ? (
                      <textarea
                        ref={el => {
                          if (el) {
                            // Auto-grow: reset and use scrollHeight
                            el.style.height = "auto";
                            el.style.height = (el.scrollHeight + 2) + "px";
                          }
                        }}
                        autoFocus
                        value={tb.text}
                        onPointerDown={e => e.stopPropagation()}
                        onPointerMove={e => e.stopPropagation()}
                        onPointerUp={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          updateText(tb.id, { text: e.target.value });
                          // Auto-grow on input
                          e.target.style.height = "auto";
                          e.target.style.height = (e.target.scrollHeight + 2) + "px";
                        }}
                        onBlur={() => {
                          // Commit on blur unless we're switching format (sheet open)
                          if (activeSheet === "textFormat") return;
                          // If user left without typing anything, remove the empty placeholder block
                          if (!tb.text || !tb.text.trim()) {
                            setTextBoxes(prev => prev.filter(t => t.id !== tb.id));
                            setSelectedItem(null);
                          }
                          setEditingTextId(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === "Escape") { e.preventDefault(); setEditingTextId(null); e.target.blur(); }
                          // Stop key events from bubbling to canvas/page shortcuts
                          e.stopPropagation();
                        }}
                        placeholder="Type here..."
                        rows={1}
                        style={{
                          ...baseStyle,
                          width: availW,
                          minHeight: tb.size * 1.4 + 12,
                          border: "1.5px solid #6366f1",
                          background: "rgba(255,255,255,0.95)",
                          borderRadius: 4,
                          padding: 4,
                          resize: "none",
                          outline: "none",
                          boxSizing: "border-box",
                          overflow: "hidden",
                        }}
                      />
                    ) : (
                      <div
                        onPointerDown={e => {
                          if (tool === "select" || tool === "text") {
                            startDragOrTap(e, "text", tb.id);
                          }
                        }}
                        style={{
                          ...baseStyle,
                          display: "inline-block",
                          maxWidth: availW,
                          padding: 4,
                          border: isSelected ? "1.5px dashed #6366f1" : "1.5px dashed transparent",
                          borderRadius: 4,
                          background: isSelected ? "rgba(99,102,241,0.05)" : "transparent",
                          cursor: tool === "select" ? "text" : "default",
                          minHeight: tb.size * 1.4,
                          minWidth: 40,
                          color: tb.text ? tb.color : "#94a3b8",
                          fontStyle: tb.text ? (tb.italic ? "italic" : "normal") : "italic",
                        }}
                      >
                        {tb.text || "Tap to edit"}
                      </div>
                    )}
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ─── SELECTED ITEM ACTION BAR (above main toolbar) ─── */}
      {selectedItem && (
        <div style={{
          padding: "8px 12px", background: "#0b1120",
          borderTop: "1px solid #1e293b",
          display: "flex", alignItems: "center", gap: 8,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", flex: 1 }}>
            {selectedItem.type === "text" ? "📝 Text selected" : "🖼️ Image selected"}
            <span style={{ fontSize: 10, color: "#64748b", marginLeft: 8 }}>
              {selectedItem.type === "text" ? "Tap to edit · drag to move" : "Drag corner to resize"}
            </span>
          </div>
          {selectedItem.type === "text" && (
            <button
              onClick={() => setActiveSheet("textFormat")}
              style={{
                padding: "8px 14px", borderRadius: 8,
                border: "1px solid #6366f1", background: "#6366f122",
                color: "#818cf8", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: 600, minHeight: 40,
              }}
            >
              Format Text
            </button>
          )}
          <button
            onClick={deleteSelected}
            style={{
              padding: "8px 14px", borderRadius: 8,
              border: "1px solid #7f1d1d", background: "transparent",
              color: "#ef4444", cursor: "pointer", fontFamily: "inherit",
              fontSize: 13, fontWeight: 600, minHeight: 40,
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <Trash2 size={15} /> Delete
          </button>
        </div>
      )}

      {/* ─── MAIN BOTTOM TOOLBAR ─── */}
      <div style={{
        padding: "10px 12px",
        paddingBottom: "max(10px, env(safe-area-inset-bottom))",
        background: "#0b1120", borderTop: "1px solid #1e293b",
        display: "flex", gap: 6, overflowX: "auto",
        flexShrink: 0,
        scrollbarWidth: "thin",
      }}>
        <ToolButton id="select" Icon={MousePointer2} label="Select" active={tool === "select"} onClick={() => { setTool("select"); setActiveSheet(null); }} />
        <ToolButton id="pen" Icon={Pencil} label="Pen" active={tool === "pen"} accent={color} onClick={() => { setTool("pen"); setActiveSheet(null); setSelectedItem(null); setEditingTextId(null); }} />
        <ToolButton id="eraser" Icon={Eraser} label="Eraser" active={tool === "eraser"} onClick={() => { setTool("eraser"); setActiveSheet(null); setSelectedItem(null); setEditingTextId(null); }} />
        <ToolButton id="text" Icon={Type} label="Text" active={tool === "text"} onClick={() => { setTool("text"); setActiveSheet(null); setSelectedItem(null); setEditingTextId(null); }} />

        <div style={{ width: 1, alignSelf: "stretch", background: "#1e293b", margin: "0 2px" }} />

        {/* Color picker — opens bottom sheet */}
        <button
          onClick={() => setActiveSheet(activeSheet === "color" ? null : "color")}
          title="Pen color"
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
            minWidth: isMobile ? 60 : 70, height: isMobile ? 56 : 60,
            padding: "6px 8px", borderRadius: 10,
            border: activeSheet === "color" ? "2px solid #6366f1" : "1px solid #1e293b",
            background: "#1a2332", color: "#cbd5e1",
            cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, flexShrink: 0,
          }}
        >
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: color, border: "2px solid #fff" }} />
          <span>Color</span>
        </button>

        {/* Size picker — opens bottom sheet */}
        <button
          onClick={() => setActiveSheet(activeSheet === "size" ? null : "size")}
          title="Pen size"
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
            minWidth: isMobile ? 60 : 70, height: isMobile ? 56 : 60,
            padding: "6px 8px", borderRadius: 10,
            border: activeSheet === "size" ? "2px solid #6366f1" : "1px solid #1e293b",
            background: "#1a2332", color: "#cbd5e1",
            cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, flexShrink: 0,
          }}
        >
          <div style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: size * 1.5 + 4, height: size * 1.5 + 4, borderRadius: "50%", background: color }} />
          </div>
          <span>Size</span>
        </button>

        <div style={{ width: 1, alignSelf: "stretch", background: "#1e293b", margin: "0 2px" }} />

        {/* Image */}
        <label style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
          minWidth: isMobile ? 60 : 70, height: isMobile ? 56 : 60,
          padding: "6px 8px", borderRadius: 10,
          border: "1px solid #1e293b", background: "#1a2332",
          color: uploading ? "#475569" : "#cbd5e1",
          cursor: uploading ? "wait" : "pointer", fontFamily: "inherit",
          fontSize: 11, fontWeight: 600, flexShrink: 0,
        }}>
          <ImageIcon size={isMobile ? 22 : 20} />
          <span>{uploading ? "..." : "Photo"}</span>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} disabled={uploading} />
        </label>

        <ToolButton Icon={Undo2} label="Undo" disabled={strokes.length === 0} onClick={undoLast} />

        {/* Zoom controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
          <button
            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
            style={{ width: isMobile ? 60 : 70, height: 27, borderRadius: "10px 10px 0 0", border: "1px solid #1e293b", background: "#1a2332", color: "#cbd5e1", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 2, fontFamily: "inherit", fontSize: 10, fontWeight: 600 }}
          >
            <Plus size={12} /> {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            style={{ width: isMobile ? 60 : 70, height: 27, borderRadius: "0 0 10px 10px", border: "1px solid #1e293b", borderTop: "none", background: "#1a2332", color: "#cbd5e1", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}
          >
            <Minus size={14} />
          </button>
        </div>

        <div style={{ flex: 1, minWidth: 4 }} />

        <ToolButton Icon={Trash2} label="Clear All" danger onClick={clearAll} />
      </div>

      {/* ─── BOTTOM SHEET: COLOR ─── */}
      {activeSheet === "color" && (
        <BottomSheet title="Pen Color" onClose={() => setActiveSheet(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {PEN_COLORS.map(c => (
              <button
                key={c.hex}
                onClick={() => { setColor(c.hex); setActiveSheet(null); }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  padding: "12px 8px", borderRadius: 10,
                  border: color === c.hex ? "2px solid #818cf8" : "1px solid #334155",
                  background: color === c.hex ? "#6366f122" : "#0f1729",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: c.hex, border: "2px solid #fff" }} />
                <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600 }}>{c.name}</span>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {/* ─── BOTTOM SHEET: SIZE ─── */}
      {activeSheet === "size" && (
        <BottomSheet title="Pen Size" onClose={() => setActiveSheet(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PEN_SIZES.map(s => (
              <button
                key={s.v}
                onClick={() => { setSize(s.v); setActiveSheet(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "14px 16px", borderRadius: 10,
                  border: size === s.v ? "2px solid #818cf8" : "1px solid #334155",
                  background: size === s.v ? "#6366f122" : "#0f1729",
                  cursor: "pointer", fontFamily: "inherit",
                  minHeight: 56, textAlign: "left",
                }}
              >
                <div style={{ width: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: s.v * 2 + 8, height: s.v * 2 + 8, borderRadius: "50%", background: color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, color: "#fff", fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{s.v}px</div>
                </div>
                {/* Visual preview line */}
                <svg width="80" height="20" style={{ flexShrink: 0 }}>
                  <line x1="4" y1="10" x2="76" y2="10" stroke={color} strokeWidth={s.v} strokeLinecap="round" />
                </svg>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {/* ─── BOTTOM SHEET: TEXT FORMATTING ─── */}
      {activeSheet === "textFormat" && selectedTextBox && (
        <BottomSheet title="Format Text" onClose={() => setActiveSheet(null)}>
          {/* Font size */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Size</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[14, 18, 22, 28, 36, 48, 64].map(s => (
                <button
                  key={s}
                  onClick={() => updateText(selectedTextBox.id, { size: s })}
                  style={{
                    minWidth: 50, minHeight: 44, padding: "8px 12px",
                    borderRadius: 8,
                    border: selectedTextBox.size === s ? "2px solid #818cf8" : "1px solid #334155",
                    background: selectedTextBox.size === s ? "#6366f122" : "#0f1729",
                    color: "#cbd5e1", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Style toggles */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Style</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { Icon: Bold, key: "bold", label: "Bold" },
                { Icon: Italic, key: "italic", label: "Italic" },
                { Icon: Underline, key: "underline", label: "Underline" },
              ].map(({ Icon, key, label }) => (
                <button
                  key={key}
                  onClick={() => updateText(selectedTextBox.id, { [key]: !selectedTextBox[key] })}
                  style={{
                    flex: 1, minHeight: 48, padding: "10px 8px",
                    borderRadius: 8,
                    border: selectedTextBox[key] ? "2px solid #818cf8" : "1px solid #334155",
                    background: selectedTextBox[key] ? "#6366f122" : "#0f1729",
                    color: selectedTextBox[key] ? "#818cf8" : "#cbd5e1",
                    cursor: "pointer", fontFamily: "inherit",
                    fontSize: 12, fontWeight: 600,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  }}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Alignment */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Alignment</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { Icon: AlignLeft, value: "left", label: "Left" },
                { Icon: AlignCenter, value: "center", label: "Center" },
                { Icon: AlignRight, value: "right", label: "Right" },
              ].map(({ Icon, value, label }) => {
                const cur = selectedTextBox.align || "left";
                const active = cur === value;
                return (
                  <button
                    key={value}
                    onClick={() => updateText(selectedTextBox.id, { align: value })}
                    style={{
                      flex: 1, minHeight: 48, padding: "10px 8px",
                      borderRadius: 8,
                      border: active ? "2px solid #818cf8" : "1px solid #334155",
                      background: active ? "#6366f122" : "#0f1729",
                      color: active ? "#818cf8" : "#cbd5e1",
                      cursor: "pointer", fontFamily: "inherit",
                      fontSize: 12, fontWeight: 600,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                    }}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text color */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Color</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[
                { hex: "#000000", name: "Black" },
                { hex: "#dc2626", name: "Red" },
                { hex: "#ea580c", name: "Orange" },
                { hex: "#ca8a04", name: "Yellow" },
                { hex: "#16a34a", name: "Green" },
                { hex: "#2563eb", name: "Blue" },
                { hex: "#7c3aed", name: "Purple" },
                { hex: "#ffffff", name: "White" },
              ].map(c => (
                <button
                  key={c.hex}
                  onClick={() => updateText(selectedTextBox.id, { color: c.hex })}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    padding: "10px 4px", borderRadius: 8,
                    border: selectedTextBox.color === c.hex ? "2px solid #818cf8" : "1px solid #334155",
                    background: selectedTextBox.color === c.hex ? "#6366f122" : "#0f1729",
                    cursor: "pointer", fontFamily: "inherit",
                    minHeight: 56,
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: c.hex, border: "2px solid #fff" }} />
                  <span style={{ fontSize: 10, color: "#cbd5e1", fontWeight: 600 }}>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font family */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Font</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
              {[
                { label: "Sans", value: "'DM Sans',sans-serif" },
                { label: "Display", value: "'Outfit',sans-serif" },
                { label: "Serif", value: "Georgia,serif" },
                { label: "Mono", value: "'Courier New',monospace" },
              ].map(f => {
                const cur = selectedTextBox.fontFamily || "'DM Sans',sans-serif";
                const active = cur === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => updateText(selectedTextBox.id, { fontFamily: f.value })}
                    style={{
                      minHeight: 48, padding: "10px 12px",
                      borderRadius: 8,
                      border: active ? "2px solid #818cf8" : "1px solid #334155",
                      background: active ? "#6366f122" : "#0f1729",
                      color: "#cbd5e1", cursor: "pointer",
                      fontFamily: f.value,
                      fontSize: 14, fontWeight: 600,
                      textAlign: "center",
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

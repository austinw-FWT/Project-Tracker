import { useState, useRef, useEffect } from "react";
import { Pencil, Eraser, Type, Image as ImageIcon, Trash2, X, Save, MousePointer2, Undo2, Palette } from "lucide-react";
import { storage, storageRef, uploadBytes, getDownloadURL } from "./firebase.js";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/**
 * SiteWalkCanvas — Freehand drawing + photo + text notes, stylus-friendly.
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
 *     { id, text, x, y, w, size, color }
 *   ]
 * }
 */
export default function SiteWalkCanvas({ walkId, walkTitle, canvas, onSave, onClose, uploadPathPrefix }) {
  const CANVAS_W = 1400;
  const CANVAS_H = 2000;

  const [tool, setTool] = useState("select"); // select | pen | eraser | text
  const [color, setColor] = useState("#e2e8f0");
  const [size, setSize] = useState(3);
  const [strokes, setStrokes] = useState(canvas?.strokes || []);
  const [images, setImages] = useState(canvas?.images || []);
  const [textBoxes, setTextBoxes] = useState(canvas?.textBoxes || []);
  const [currentStroke, setCurrentStroke] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null); // { type: 'image'|'text', id }
  const [dragState, setDragState] = useState(null); // { id, type, mode: 'move'|'resize', ox, oy, orig }
  const [uploading, setUploading] = useState(false);
  const [showColors, setShowColors] = useState(false);

  const svgRef = useRef(null);
  const fileRef = useRef(null);
  const saveTimer = useRef(null);

  const PEN_COLORS = ["#e2e8f0", "#f59e0b", "#10b981", "#6366f1", "#ef4444", "#ec4899", "#000000"];
  const PEN_SIZES = [2, 3, 5, 8];

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
  function handlePointerDown(e) {
    // Touch scrolling: ignore non-pen, non-mouse touches unless tool is active
    if (tool === "select") return;
    e.preventDefault();
    e.target.setPointerCapture?.(e.pointerId);

    const pt = getSvgPoint(e);
    if (tool === "pen") {
      setCurrentStroke({ id: genId(), color, size, points: [pt] });
    } else if (tool === "eraser") {
      eraseAt(pt);
    } else if (tool === "text") {
      // Drop a new text box at the click position
      const id = genId();
      setTextBoxes([...textBoxes, { id, text: "", x: pt.x, y: pt.y, w: 260, size: 18, color }]);
      setSelectedItem({ type: "text", id });
      setTool("select");
    }
  }

  function handlePointerMove(e) {
    if (tool === "pen" && currentStroke) {
      const pt = getSvgPoint(e);
      setCurrentStroke(cs => cs ? { ...cs, points: [...cs.points, pt] } : cs);
    } else if (tool === "eraser" && e.buttons > 0) {
      eraseAt(getSvgPoint(e));
    }
  }

  function handlePointerUp() {
    if (currentStroke && currentStroke.points.length > 1) {
      setStrokes(s => [...s, currentStroke]);
    }
    setCurrentStroke(null);
  }

  function eraseAt(pt) {
    const ERASE_R = 20;
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
      // Figure out a reasonable default size by loading the image
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

  // ── Item manipulation (move/resize images, move/edit text) ──
  function startDrag(e, type, id, mode = "move") {
    if (tool !== "select") return;
    e.stopPropagation();
    const pt = getSvgPoint(e);
    const orig = type === "image" ? images.find(i => i.id === id) : textBoxes.find(t => t.id === id);
    if (!orig) return;
    setDragState({ type, id, mode, ox: pt.x, oy: pt.y, orig: { ...orig } });
    setSelectedItem({ type, id });
  }

  function handleCanvasPointerMove(e) {
    handlePointerMove(e);
    if (!dragState) return;
    const pt = getSvgPoint(e);
    const dx = pt.x - dragState.ox, dy = pt.y - dragState.oy;
    if (dragState.type === "image") {
      setImages(prev => prev.map(i => i.id !== dragState.id ? i : (
        dragState.mode === "move"
          ? { ...i, x: dragState.orig.x + dx, y: dragState.orig.y + dy }
          : { ...i, w: Math.max(60, dragState.orig.w + dx), h: Math.max(40, dragState.orig.h + dy) }
      )));
    } else if (dragState.type === "text") {
      setTextBoxes(prev => prev.map(t => t.id !== dragState.id ? t : (
        dragState.mode === "move"
          ? { ...t, x: dragState.orig.x + dx, y: dragState.orig.y + dy }
          : { ...t, w: Math.max(80, dragState.orig.w + dx) }
      )));
    }
  }

  function handleCanvasPointerUp() {
    handlePointerUp();
    setDragState(null);
  }

  function updateText(id, updates) {
    setTextBoxes(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }

  function deleteSelected() {
    if (!selectedItem) return;
    if (selectedItem.type === "image") setImages(prev => prev.filter(i => i.id !== selectedItem.id));
    else if (selectedItem.type === "text") setTextBoxes(prev => prev.filter(t => t.id !== selectedItem.id));
    setSelectedItem(null);
  }

  function undoLast() {
    if (strokes.length > 0) setStrokes(s => s.slice(0, -1));
  }

  function clearAll() {
    if (!confirm("Clear entire canvas? This cannot be undone.")) return;
    setStrokes([]); setImages([]); setTextBoxes([]); setSelectedItem(null);
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

  const toolBtn = (id, Icon, label) => (
    <button
      onClick={() => setTool(id)}
      title={label}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 36, height: 36, borderRadius: 8,
        border: tool === id ? "2px solid #6366f1" : "1px solid #1e293b",
        background: tool === id ? "#6366f122" : "#1a2332",
        color: tool === id ? "#818cf8" : "#94a3b8",
        cursor: "pointer", fontFamily: "inherit",
      }}
    >
      <Icon size={16} />
    </button>
  );

  const cursorStyle = tool === "pen" ? "crosshair" : tool === "eraser" ? "cell" : tool === "text" ? "text" : "default";

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0f1729", zIndex: 100, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 12, background: "#0b1120" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontFamily: "inherit" }}>
          <X size={18} /> Close
        </button>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", flex: 1 }}>📝 {walkTitle || "Site Walk"}</div>
        <span style={{ fontSize: 11, color: "#10b981" }}>✓ Auto-saving</span>
      </div>

      {/* Toolbar */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 8, background: "#0b1120", flexWrap: "wrap" }}>
        {toolBtn("select", MousePointer2, "Select / Move")}
        {toolBtn("pen", Pencil, "Pen")}
        {toolBtn("eraser", Eraser, "Eraser")}
        {toolBtn("text", Type, "Text")}

        <div style={{ width: 1, height: 24, background: "#1e293b" }} />

        {/* Color */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowColors(!showColors)} title="Color" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#94a3b8", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: color, border: "1px solid #1e293b" }} />
            <Palette size={14} />
          </button>
          {showColors && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, display: "flex", gap: 4, padding: 6, background: "#1a2332", border: "1px solid #1e293b", borderRadius: 8, zIndex: 10 }}>
              {PEN_COLORS.map(c => (
                <button key={c} onClick={() => { setColor(c); setShowColors(false); }} style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: color === c ? "2px solid #fff" : "1px solid #1e293b", cursor: "pointer" }} />
              ))}
            </div>
          )}
        </div>

        {/* Pen size */}
        <div style={{ display: "flex", gap: 2, padding: 2, background: "#1a2332", borderRadius: 8, border: "1px solid #1e293b" }}>
          {PEN_SIZES.map(s => (
            <button key={s} onClick={() => setSize(s)} title={`Size ${s}`} style={{ width: 30, height: 28, borderRadius: 6, border: "none", background: size === s ? "#6366f122" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: s * 2, height: s * 2, borderRadius: "50%", background: size === s ? "#818cf8" : "#64748b" }} />
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: "#1e293b" }} />

        {/* Image upload */}
        <label style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px solid #6366f1", background: "#6366f122", color: "#818cf8", fontSize: 12, fontWeight: 600, cursor: uploading ? "wait" : "pointer", fontFamily: "inherit" }}>
          <ImageIcon size={14} /> {uploading ? "Uploading..." : "Add Image"}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} disabled={uploading} />
        </label>

        <button onClick={undoLast} disabled={strokes.length === 0} title="Undo last stroke" style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: strokes.length > 0 ? "#94a3b8" : "#334155", cursor: strokes.length > 0 ? "pointer" : "default", fontSize: 12, fontFamily: "inherit" }}>
          <Undo2 size={14} /> Undo
        </button>

        <div style={{ flex: 1 }} />

        {selectedItem && (
          <button onClick={deleteSelected} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, border: "1px solid #7f1d1d", background: "transparent", color: "#ef4444", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            <X size={13} /> Delete Selected
          </button>
        )}

        <button onClick={clearAll} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: "#64748b", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          <Trash2 size={13} /> Clear All
        </button>
      </div>

      {/* Canvas area */}
      <div style={{ flex: 1, overflow: "auto", padding: 20, background: "#0f1729" }}
        onClick={() => { setSelectedItem(null); setShowColors(false); }}
      >
        <div style={{ width: "100%", maxWidth: 1200, margin: "0 auto" }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            style={{
              width: "100%", height: "auto", background: "#fafafa",
              borderRadius: 8, boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
              cursor: cursorStyle,
              touchAction: tool === "select" ? "auto" : "none",
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
                      <rect x={img.x + img.w - 8} y={img.y + img.h - 8} width={16} height={16} fill="#6366f1" stroke="#fff" strokeWidth="1.5"
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
              <path
                key={stroke.id}
                d={strokeToPath(stroke)}
                fill="none"
                stroke={stroke.color}
                strokeWidth={stroke.size}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            ))}
            {currentStroke && (
              <path
                d={strokeToPath(currentStroke)}
                fill="none"
                stroke={currentStroke.color}
                strokeWidth={currentStroke.size}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            )}

            {/* Text boxes */}
            {textBoxes.map(tb => {
              const isSelected = selectedItem?.type === "text" && selectedItem.id === tb.id;
              return (
                <foreignObject key={tb.id} x={tb.x} y={tb.y} width={tb.w} height={Math.max(40, tb.size * 3)}>
                  <div
                    onPointerDown={e => {
                      // Only start move-drag from the handle (top edge), not from the text itself
                      if (e.target.classList?.contains("tb-handle")) startDrag(e, "text", tb.id, "move");
                    }}
                    onClick={e => { e.stopPropagation(); setSelectedItem({ type: "text", id: tb.id }); }}
                    style={{
                      padding: isSelected ? "2px" : 0,
                      border: isSelected ? "2px dashed #6366f1" : "2px dashed transparent",
                      borderRadius: 4,
                      background: "rgba(255,255,255,0.7)",
                      position: "relative",
                    }}
                  >
                    <div className="tb-handle" style={{ position: "absolute", top: -8, left: 0, right: 0, height: 10, cursor: "move", background: isSelected ? "#6366f1" : "transparent", borderRadius: "4px 4px 0 0" }} />
                    <textarea
                      value={tb.text}
                      onChange={e => updateText(tb.id, { text: e.target.value })}
                      placeholder="Type a note..."
                      autoFocus={tb.text === "" && isSelected}
                      style={{
                        width: "100%",
                        minHeight: tb.size * 1.5 + "px",
                        border: "none",
                        background: "transparent",
                        color: tb.color,
                        fontSize: tb.size,
                        fontFamily: "'DM Sans',sans-serif",
                        resize: "none",
                        outline: "none",
                        padding: 4,
                      }}
                    />
                  </div>
                </foreignObject>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

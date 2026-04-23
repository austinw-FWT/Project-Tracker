import { useState } from "react";
import { Plus, Archive, ArchiveRestore, Trash2, FileText, Calendar } from "lucide-react";
import SiteWalkCanvas from "./SiteWalkCanvas.jsx";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/**
 * MeetingNotes — standalone canvas-based meeting notes with archive.
 *
 * Data model (stored at data.meetings, a top-level array):
 * {
 *   id, title, date, archived,
 *   canvas: { width, height, strokes, images, textBoxes },
 *   createdAt, updatedAt
 * }
 */
export default function MeetingNotes({ meetings = [], onSave }) {
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [tab, setTab] = useState("active"); // active | archived

  function saveAll(next) { onSave(next); }

  function addMeeting() {
    const id = genId();
    const now = new Date().toISOString();
    const newMeeting = {
      id,
      title: `Meeting — ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString().split("T")[0],
      archived: false,
      canvas: { width: 1400, height: 2000, strokes: [], images: [], textBoxes: [] },
      createdAt: now,
      updatedAt: now,
    };
    saveAll([...meetings, newMeeting]);
    setActiveNoteId(id);
  }

  function renameMeeting(id, title) {
    saveAll(meetings.map(m => m.id === id ? { ...m, title, updatedAt: new Date().toISOString() } : m));
  }

  function updateDate(id, date) {
    saveAll(meetings.map(m => m.id === id ? { ...m, date, updatedAt: new Date().toISOString() } : m));
  }

  function toggleArchive(id) {
    saveAll(meetings.map(m => m.id === id ? { ...m, archived: !m.archived, updatedAt: new Date().toISOString() } : m));
  }

  function deleteMeeting(id) {
    if (!confirm("Delete this meeting and all its notes/drawings? This cannot be undone.")) return;
    saveAll(meetings.filter(m => m.id !== id));
  }

  function saveCanvas(id, canvas) {
    saveAll(meetings.map(m => m.id === id ? { ...m, canvas, updatedAt: new Date().toISOString() } : m));
  }

  // If a meeting is open, render the canvas fullscreen
  if (activeNoteId) {
    const meeting = meetings.find(m => m.id === activeNoteId);
    if (!meeting) { setActiveNoteId(null); return null; }
    return (
      <SiteWalkCanvas
        walkId={meeting.id}
        walkTitle={meeting.title}
        canvas={meeting.canvas}
        onSave={(canvas) => saveCanvas(meeting.id, canvas)}
        onClose={() => setActiveNoteId(null)}
        uploadPathPrefix={`meetings/${meeting.id}`}
      />
    );
  }

  const filtered = meetings.filter(m => tab === "active" ? !m.archived : m.archived);
  const sorted = [...filtered].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "") ||
    (b.createdAt || "").localeCompare(a.createdAt || "")
  );

  const activeCount = meetings.filter(m => !m.archived).length;
  const archivedCount = meetings.filter(m => m.archived).length;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header with tabs + New button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 4, background: "#0f1729", borderRadius: 10, padding: 4, border: "1px solid #1e293b" }}>
          <button
            onClick={() => setTab("active")}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: tab === "active" ? "#6366f1" : "transparent", color: tab === "active" ? "#fff" : "#94a3b8", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setTab("archived")}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: tab === "archived" ? "#6366f1" : "transparent", color: tab === "archived" ? "#fff" : "#94a3b8", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}
          >
            Archived ({archivedCount})
          </button>
        </div>
        {tab === "active" && (
          <button
            onClick={addMeeting}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#6366f1", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}
          >
            <Plus size={16} /> New Meeting
          </button>
        )}
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div style={{ background: "#0f1729", borderRadius: 12, padding: 48, textAlign: "center", border: "1px solid #1e293b" }}>
          <FileText size={40} color="#334155" style={{ margin: "0 auto 12px", display: "block" }} />
          <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 4 }}>
            {tab === "active" ? "No meeting notes yet" : "No archived meetings"}
          </div>
          {tab === "active" && (
            <div style={{ color: "#475569", fontSize: 12 }}>
              Click "New Meeting" to start taking notes
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {sorted.map(m => {
            const strokes = m.canvas?.strokes?.length || 0;
            const images = m.canvas?.images?.length || 0;
            const texts = m.canvas?.textBoxes?.length || 0;
            return (
              <div
                key={m.id}
                style={{ background: "#0f1729", borderRadius: 12, padding: 16, border: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <input
                    value={m.title}
                    onChange={e => renameMeeting(m.id, e.target.value)}
                    style={{ background: "transparent", border: "none", color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "'Outfit', sans-serif", width: "100%", padding: 0, outline: "none" }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Calendar size={12} />
                      <input
                        type="date"
                        value={m.date || ""}
                        onChange={e => updateDate(m.id, e.target.value)}
                        style={{ background: "transparent", border: "none", color: "#94a3b8", fontFamily: "inherit", fontSize: 11, padding: 0, outline: "none", colorScheme: "dark" }}
                      />
                    </div>
                    <span>•</span>
                    <span>{strokes} strokes · {images} images · {texts} notes</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => setActiveNoteId(m.id)}
                    style={{ background: "#1e293b", color: "#e2e8f0", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => toggleArchive(m.id)}
                    title={m.archived ? "Unarchive" : "Archive"}
                    style={{ background: "transparent", color: "#64748b", border: "1px solid #1e293b", padding: 8, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center" }}
                  >
                    {m.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                  </button>
                  <button
                    onClick={() => deleteMeeting(m.id)}
                    title="Delete"
                    style={{ background: "transparent", color: "#ef4444", border: "1px solid #1e293b", padding: 8, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

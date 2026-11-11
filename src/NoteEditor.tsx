import { useEffect, useRef, useState, useMemo } from "react";
import { EditorView, basicSetup } from "codemirror";
import { markdown, pasteURLAsLink } from "@codemirror/lang-markdown";
import { indentWithTab } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  FileText,
  Clock3,
} from "lucide-react";
import { CompanyLogo } from "./icons";
import type { Application, Company, Round } from "./data";

export const PREP_NOTES_TEMPLATE = `## Topics to revise

- 

## Questions to ask

- 

## Notes

`;

export const INTERVIEW_NOTES_TEMPLATE = `## Questions asked

- 

## How it went

- 

## Follow-ups

- 
`;

export interface NoteEditorProps {
  application: Application;
  company: Company;
  round: Round;
  type: "prep" | "interview";
  onBack: () => void;
  onSave: (markdown: string) => void;
}

export function NoteEditor({
  application: app,
  company,
  round,
  type,
  onBack,
  onSave,
}: NoteEditorProps) {
  const initialContent = useMemo(() => {
    const raw = type === "prep" ? round.prep : round.notes;
    if (raw && raw.trim().length > 0) {
      return raw;
    }
    return type === "prep" ? PREP_NOTES_TEMPLATE : INTERVIEW_NOTES_TEMPLATE;
  }, [round.prep, round.notes, type]);

  const [content, setContent] = useState(initialContent);
  const [isPreview, setIsPreview] = useState(false);
  const [saved, setSaved] = useState(true);

  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  const timerRef = useRef<any>(null);

  // Debounced autosave (500ms)
  const handleContentChange = (newVal: string) => {
    setContent(newVal);
    setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSave(newVal);
      setSaved(true);
    }, 500);
  };

  // Toggle preview mode
  const togglePreview = () => {
    setIsPreview((prev) => !prev);
  };

  // Global Ctrl+E / Cmd+E shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        togglePreview();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Initialize CodeMirror 6 editor
  useEffect(() => {
    if (isPreview || !editorContainerRef.current) return;

    const documentTheme = EditorView.theme({
      "&": {
        height: "100%",
        minHeight: "520px",
        fontSize: "15px",
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: "transparent",
      },
      ".cm-scroller": {
        fontFamily: "inherit",
        lineHeight: "1.75",
        overflow: "auto",
      },
      ".cm-content": {
        padding: "8px 0 100px 0",
        caretColor: "#c07a4e",
        maxWidth: "100%",
        color: "#374151",
      },
      "&.cm-focused": {
        outline: "none",
      },
      ".cm-line": {
        padding: "0 2px",
      },
      ".cm-gutters": {
        display: "none",
      },
      ".cm-activeLine": {
        backgroundColor: "transparent",
      },
      ".cm-selectionBackground, ::selection": {
        backgroundColor: "#e8efe1 !important",
      },
    });

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const val = update.state.doc.toString();
        handleContentChange(val);
      }
    });

    const ctrlEKeymap = keymap.of([
      indentWithTab,
      {
        key: "Mod-e",
        run: () => {
          togglePreview();
          return true;
        },
      },
    ]);

    const view = new EditorView({
      doc: contentRef.current,
      extensions: [
        basicSetup,
        markdown(),
        pasteURLAsLink,
        ctrlEKeymap,
        documentTheme,
        updateListener,
        EditorView.lineWrapping,
      ],
      parent: editorContainerRef.current,
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
  }, [isPreview]);

  // Export as .md file
  const handleExport = () => {
    const safeCompany = company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const safeRole = app.role.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const roundPos = (round.position ?? 0) + 1;
    const filename = `${safeCompany}-${safeRole}-round-${roundPos}-${type}-notes.md`;

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  const roundNum = (round.position ?? 0) + 1;
  const titleDisplay = `${round.title || round.type} · ${
    type === "prep" ? "Preparation Notes" : "Interview Notes"
  }`;

  return (
    <div className="note-editor-page" style={{ maxWidth: "880px", margin: "0 auto", padding: "28px 24px 80px" }}>
      {/* Breadcrumbs Navigation */}
      <nav
        className="note-breadcrumbs"
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          fontSize: "12px",
          color: "#8a9879",
          marginBottom: "24px",
        }}
      >
        <button
          type="button"
          className="text-link"
          onClick={onBack}
          style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#687b55" }}
        >
          <ArrowLeft size={13} />
          Back to application
        </button>
        <ChevronRight size={13} style={{ color: "#b3bea6" }} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <CompanyLogo name={company.name} color={company.color} size={16} />
          <strong>{company.name}</strong> · {app.role}
        </span>
        <ChevronRight size={13} style={{ color: "#b3bea6" }} />
        <span>
          Round {roundNum} ({round.type})
        </span>
        <ChevronRight size={13} style={{ color: "#b3bea6" }} />
        <span style={{ color: "#3e4834", fontWeight: 600 }}>
          {type === "prep" ? "Prep notes" : "Interview notes"}
        </span>
      </nav>

      {/* Document Header & Controls */}
      <header
        className="note-document-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          borderBottom: "1px solid #e3e8da",
          paddingBottom: "16px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#687b55",
                background: "#f0f4ea",
                padding: "2px 8px",
                borderRadius: "4px",
              }}
            >
              Round {roundNum}
            </span>
            {round.date && (
              <span className="muted small" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Clock3 size={12} />
                {round.date.slice(0, 10)}
              </span>
            )}
            <span className={`round-status ${round.status?.toLowerCase() || "upcoming"}`}>
              {round.status || "upcoming"}
            </span>
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#3e4834", margin: "4px 0" }}>
            {titleDisplay}
          </h1>
          <p className="muted small" style={{ margin: "2px 0 0" }}>
            {type === "prep"
              ? "Key topics, questions to ask, and strategic talking points."
              : "Questions asked, evaluation notes, and interview reflections."}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Subtle Saved Indicator */}
          {saved ? (
            <span className="saved-badge">
              <Check size={13} /> Saved
            </span>
          ) : (
            <span className="muted small" style={{ fontStyle: "italic", fontSize: "11px" }}>
              Saving...
            </span>
          )}

          {/* Mode Toggle Button (Ctrl+E) */}
          <button
            type="button"
            className="button secondary"
            onClick={togglePreview}
            title="Toggle Edit / Rendered Preview (Ctrl+E)"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "6px 12px" }}
          >
            {isPreview ? (
              <>
                <Edit3 size={14} /> Edit (Ctrl+E)
              </>
            ) : (
              <>
                <Eye size={14} /> Preview (Ctrl+E)
              </>
            )}
          </button>

          {/* Export as .md Button */}
          <button
            type="button"
            className="button secondary"
            onClick={handleExport}
            title="Download plain markdown file"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "6px 12px" }}
          >
            <Download size={14} /> Export as .md
          </button>
        </div>
      </header>

      {/* Editor or Rendered Preview Document Container */}
      <div
        className="note-document-body"
        style={{
          background: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #e3e8da",
          padding: "32px 36px",
          minHeight: "580px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
        }}
      >
        {isPreview ? (
          <div className="markdown-preview-rendered" style={{ lineHeight: "1.8", color: "#374151" }}>
            {content.trim() ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node, ...props }) => (
                    <a {...props} target="_blank" rel="noreferrer" className="text-link" />
                  ),
                  input: ({ node, ...props }) => (
                    <input {...props} disabled style={{ marginRight: "6px", accentColor: "#6c8452" }} />
                  ),
                  table: ({ node, ...props }) => (
                    <table {...props} style={{ borderCollapse: "collapse", width: "100%", margin: "16px 0" }} />
                  ),
                  th: ({ node, ...props }) => (
                    <th
                      {...props}
                      style={{
                        border: "1px solid #dbe4d1",
                        padding: "8px 12px",
                        background: "#f7f9f4",
                        textAlign: "left",
                        fontWeight: 600,
                      }}
                    />
                  ),
                  td: ({ node, ...props }) => (
                    <td {...props} style={{ border: "1px solid #e3e8da", padding: "8px 12px" }} />
                  ),
                  code: ({ node, className, children, ...props }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code
                        style={{
                          background: "#f0f4ea",
                          padding: "2px 5px",
                          borderRadius: "4px",
                          fontSize: "13px",
                          color: "#4a5a3a",
                          fontFamily: "monospace",
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <pre
                        style={{
                          background: "#2d3748",
                          color: "#f7fafc",
                          padding: "16px",
                          borderRadius: "6px",
                          overflowX: "auto",
                          fontSize: "13px",
                          lineHeight: "1.6",
                          margin: "16px 0",
                        }}
                      >
                        <code {...props}>{children}</code>
                      </pre>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            ) : (
              <p className="muted small" style={{ fontStyle: "italic" }}>
                Empty document. Press Ctrl+E to switch to edit mode.
              </p>
            )}
          </div>
        ) : (
          <div ref={editorContainerRef} className="codemirror-wrapper" />
        )}
      </div>

      <footer style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="muted small" style={{ fontSize: "11px" }}>
          Markdown format · Tab indents lists · Pasted URLs auto-link · Ctrl+E toggles preview
        </span>
        <button
          type="button"
          className="text-link"
          onClick={onBack}
          style={{ fontSize: "12px", color: "#687b55" }}
        >
          Return to application
        </button>
      </footer>
    </div>
  );
}


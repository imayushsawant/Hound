import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { ExternalLink, FileText, FolderOpen, Trash2, Upload, X } from "./icons";
import {
  buildApplicationFolderName,
  getResumeDisplayFileName,
  getResumeDisplayFolder,
  sanitizeFolderName,
} from "./shared/resumes";

export interface StagedResume {
  file?: File;
  filePath?: string;
  fileName: string;
  buffer?: ArrayBuffer;
}

interface ResumeDropzoneProps {
  companyName: string;
  role: string;
  date?: string;
  value?: string; // existing saved relative or filename
  staged?: StagedResume | null;
  onStageChange?: (staged: StagedResume | null) => void;
  onClearValue?: () => void;
  onSaveImmediate?: (staged: StagedResume) => Promise<void>;
  disabled?: boolean;
}

export function ResumeDropzone({
  companyName,
  role,
  date,
  value,
  staged,
  onStageChange,
  onClearValue,
  onSaveImmediate,
  disabled = false,
}: ResumeDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayFile = staged?.fileName || (value ? getResumeDisplayFileName(value) : "");
  const displayFolder = value
    ? getResumeDisplayFolder(value)
    : `${sanitizeFolderName(companyName || "Company")}/${buildApplicationFolderName(role || "role", date)}`;

  const handleProcessFile = async (file: File) => {
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const filePath = window.houndDesktop?.getPathForFile?.(file) || (file as any).path || "";
      const newStaged: StagedResume = {
        file,
        filePath: filePath || undefined,
        fileName: file.name,
        buffer,
      };

      if (onSaveImmediate) {
        setBusy(true);
        try {
          await onSaveImmediate(newStaged);
        } finally {
          setBusy(false);
        }
      } else if (onStageChange) {
        onStageChange(newStaged);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to process resume file");
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || busy) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || busy) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await handleProcessFile(file);
    }
  };

  const handleBrowseClick = async () => {
    if (disabled || busy) return;
    setError(null);

    // If running in Desktop app with electron dialog support
    if (window.houndDesktop?.selectResumeFile) {
      try {
        const selected = await window.houndDesktop.selectResumeFile();
        if (selected) {
          const newStaged: StagedResume = {
            filePath: selected.filePath,
            fileName: selected.fileName,
          };
          if (onSaveImmediate) {
            setBusy(true);
            try {
              await onSaveImmediate(newStaged);
            } finally {
              setBusy(false);
            }
          } else if (onStageChange) {
            onStageChange(newStaged);
          }
        }
      } catch (err: any) {
        setError(err?.message || "Failed to open file picker");
      }
      return;
    }

    // Web fallback: click native input
    fileInputRef.current?.click();
  };

  const handleNativeInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await handleProcessFile(file);
    }
    // Reset so same file can be re-selected if desired
    e.target.value = "";
  };

  const handleClear = () => {
    if (onStageChange) onStageChange(null);
    if (onClearValue) onClearValue();
  };

  const handleOpenFile = async () => {
    if (!value) return;
    if (window.houndDesktop?.openPath) {
      await window.houndDesktop.openPath(value);
    }
  };

  const handleOpenFolder = async () => {
    if (!value) {
      // If not yet saved but in desktop, open root resumes folder
      if (window.houndDesktop?.openResumesFolder) {
        await window.houndDesktop.openResumesFolder();
      }
      return;
    }
    if (window.houndDesktop?.showItemInFolder) {
      await window.houndDesktop.showItemInFolder(value);
    } else if (window.houndDesktop?.openPath) {
      const folder = getResumeDisplayFolder(value);
      await window.houndDesktop.openPath(folder);
    }
  };

  const hasResume = Boolean(staged || value);

  return (
    <div className="resume-dropzone-container" style={{ width: "100%", marginTop: "4px" }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleNativeInputChange}
        accept=".pdf,.doc,.docx,.txt,.rtf"
        style={{ display: "none" }}
      />

      {hasResume ? (
        <div
          className="resume-card"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "12px 14px",
            background: "#f4f7f2",
            border: "1px solid #d3dec8",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "6px",
                  background: "#e4ece0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#4e6538",
                  flexShrink: 0,
                }}
              >
                <FileText size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#27341e",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={displayFile}
                >
                  {displayFile}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#6b7c5c",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    marginTop: "2px",
                  }}
                  title={`Stored in: ${displayFolder}`}
                >
                  <FolderOpen size={12} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {displayFolder}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              {value && window.houndDesktop?.openPath && (
                <button
                  type="button"
                  onClick={handleOpenFile}
                  title="Open resume file"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #c9d6be",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#3f542b",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <ExternalLink size={13} />
                  <span>Open file</span>
                </button>
              )}

              {value && (window.houndDesktop?.showItemInFolder || window.houndDesktop?.openPath) && (
                <button
                  type="button"
                  onClick={handleOpenFolder}
                  title="Open folder in File Explorer"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #c9d6be",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#3f542b",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <FolderOpen size={13} />
                  <span>Open folder</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleBrowseClick}
                title="Replace resume"
                disabled={disabled || busy}
                style={{
                  background: "#ffffff",
                  border: "1px solid #c9d6be",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "#3f542b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Upload size={13} />
                <span>Replace</span>
              </button>

              <button
                type="button"
                onClick={handleClear}
                title="Remove resume"
                disabled={disabled || busy}
                style={{
                  background: "transparent",
                  border: "none",
                  borderRadius: "6px",
                  padding: "4px",
                  color: "#8a9a7d",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {staged && !value && (
            <div
              style={{
                fontSize: "10.5px",
                color: "#5b6e49",
                background: "#eaf0e4",
                padding: "4px 8px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>Will be saved to backend folder:</span>
              <strong style={{ fontWeight: 600 }}>{displayFolder}</strong>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
          style={{
            border: `2px dashed ${isDragging ? "#52753a" : "#cbd7c1"}`,
            background: isDragging ? "#f1f7ed" : "#fafcfa",
            borderRadius: "8px",
            padding: "16px 20px",
            textAlign: "center",
            cursor: disabled || busy ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: isDragging ? "#e4f0dc" : "#eef4eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isDragging ? "#3d5c28" : "#5d734c",
              marginBottom: "2px",
            }}
          >
            <Upload size={20} />
          </div>

          <div style={{ fontSize: "13px", fontWeight: 600, color: "#364728" }}>
            Drop your resume here, or <span style={{ color: "#4f7236", textDecoration: "underline" }}>browse</span>
          </div>

          <div style={{ fontSize: "11px", color: "#748666" }}>
            Supports PDF, DOCX, DOC, or TXT
          </div>

          {companyName && role && (
            <div
              style={{
                marginTop: "4px",
                fontSize: "10.5px",
                color: "#6c805a",
                background: "#edf3e7",
                padding: "3px 10px",
                borderRadius: "12px",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={`Saved into: ${displayFolder}`}
            >
              Target folder: <strong>{displayFolder}</strong>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ fontSize: "11px", color: "#c2410c", marginTop: "4px" }}>
          {error}
        </div>
      )}
    </div>
  );
}

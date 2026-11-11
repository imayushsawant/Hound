import { useEffect, useState, type FormEvent } from "react";
import { ApplicationStatuses, type ApplicationStatus, type Company } from "./shared/api";
import { Check, HoundMark, X } from "./icons";

export function QuickAdd() {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<ApplicationStatus>("Applied");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Load companies for autocomplete if available
    window.nudge?.listCompanies().then(setCompanies).catch(() => {});

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        window.houndDesktop?.closeQuickAdd?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const compName = company.trim();
    const roleName = role.trim();
    if (!compName || !roleName || submitting) return;

    setSubmitting(true);
    try {
      if (window.nudge?.createApplication) {
        await window.nudge.createApplication({
          company_name: compName,
          role: roleName,
          status,
        });
      }
      window.houndDesktop?.closeQuickAdd?.();
    } catch (err) {
      console.error("Quick add failed:", err);
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#fafbf9",
        color: "#28341e",
        fontFamily: "'DM Sans', sans-serif",
        boxSizing: "border-box",
        padding: "16px",
        userSelect: "none",
        border: "1px solid #d5dfc9",
      }}
    >
      <div
        style={
          {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
            paddingBottom: "8px",
            borderBottom: "1px solid #e7ede0",
            WebkitAppRegion: "drag",
          } as any
        }
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <HoundMark size={20} />
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#3e4c30" }}>
            Quick Add Application
          </span>
        </div>
        <button
          type="button"
          onClick={() => window.houndDesktop?.closeQuickAdd?.()}
          style={
            {
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#8a9978",
              display: "flex",
              alignItems: "center",
              padding: "2px",
              WebkitAppRegion: "no-drag",
            } as any
          }
          title="Close (Esc)"
        >
          <X size={16} />
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          flex: 1,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label
            htmlFor="quick-company"
            style={{ fontSize: "11px", fontWeight: 600, color: "#627252" }}
          >
            Company
          </label>
          <input
            id="quick-company"
            list="quick-add-company-list"
            required
            autoFocus
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Linear"
            style={{
              padding: "7px 10px",
              borderRadius: "6px",
              border: "1px solid #ccd6c0",
              fontSize: "13px",
              background: "#ffffff",
              color: "#1f2915",
              outline: "none",
            }}
          />
          <datalist id="quick-add-company-list">
            {companies.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label
            htmlFor="quick-role"
            style={{ fontSize: "11px", fontWeight: 600, color: "#627252" }}
          >
            Role
          </label>
          <input
            id="quick-role"
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Senior Frontend Engineer"
            style={{
              padding: "7px 10px",
              borderRadius: "6px",
              border: "1px solid #ccd6c0",
              fontSize: "13px",
              background: "#ffffff",
              color: "#1f2915",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label
            htmlFor="quick-status"
            style={{ fontSize: "11px", fontWeight: 600, color: "#627252" }}
          >
            Status
          </label>
          <select
            id="quick-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
            style={{
              padding: "7px 10px",
              borderRadius: "6px",
              border: "1px solid #ccd6c0",
              fontSize: "13px",
              background: "#ffffff",
              color: "#1f2915",
              outline: "none",
            }}
          >
            {ApplicationStatuses.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: "6px",
          }}
        >
          <span style={{ fontSize: "11px", color: "#8a9978" }}>
            Press <kbd style={{ padding: "1px 4px", border: "1px solid #ccd6c0", borderRadius: "3px", fontSize: "10px" }}>Enter</kbd> to save · <kbd style={{ padding: "1px 4px", border: "1px solid #ccd6c0", borderRadius: "3px", fontSize: "10px" }}>Esc</kbd> to close
          </span>
          <button
            type="submit"
            disabled={submitting || !company.trim() || !role.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              background: "#4f6638",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              opacity: submitting || !company.trim() || !role.trim() ? 0.6 : 1,
            }}
          >
            <Check size={14} />
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

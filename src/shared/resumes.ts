/**
 * Sanitizes a directory/folder name for safe filesystem usage across Windows, macOS, and Linux.
 */
export function sanitizeFolderName(name: string): string {
  if (!name) return "General";
  // Remove Windows-restricted chars: < > : " / \ | ? * and control chars
  const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim();
  // Strip trailing dots or spaces which are invalid in Windows folder names
  const stripped = cleaned.replace(/[. ]+$/, "");
  return stripped || "General";
}

/**
 * Sanitizes a filename.
 */
export function sanitizeFileName(name: string): string {
  if (!name) return "resume.pdf";
  const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim();
  return cleaned || "resume.pdf";
}

/**
 * Builds the folder name for a specific application inside the company folder:
 * "application-role-and-the-date-I-have-created-that-application-on"
 *
 * Example: role = "Software Development Intern", date = "2026-11-14"
 * Output: "application-software-development-intern-2026-11-14"
 */
export function buildApplicationFolderName(role: string, dateStr?: string): string {
  const cleanRole = (role || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const today = new Date().toISOString().slice(0, 10);
  const cleanDate = (dateStr || today).trim().replace(/[^0-9-]/g, "");

  const rolePart = cleanRole || "role";
  const datePart = cleanDate || today;

  return `application-${rolePart}-${datePart}`;
}

/**
 * Returns the relative path for a resume:
 * e.g. "Stripe/application-software-development-intern-2026-11-14/my-resume.pdf"
 */
export function buildResumeRelativePath(
  company: string,
  role: string,
  dateStr: string | undefined,
  fileName: string,
): string {
  const companyDir = sanitizeFolderName(company);
  const appFolder = buildApplicationFolderName(role, dateStr);
  const safeFile = sanitizeFileName(fileName);
  return `${companyDir}/${appFolder}/${safeFile}`;
}

/**
 * Extracts the display filename from a resume string:
 * If it's a relative path like "Stripe/application-.../resume.pdf", returns "resume.pdf".
 */
export function getResumeDisplayFileName(resumePath: string | null | undefined): string {
  if (!resumePath) return "";
  const parts = resumePath.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || "";
}

/**
 * Extracts the folder part from a relative resume path:
 * e.g. "Stripe/application-.../resume.pdf" -> "Stripe/application-..."
 */
export function getResumeDisplayFolder(resumePath: string | null | undefined): string {
  if (!resumePath) return "";
  const parts = resumePath.replace(/\\/g, "/").split("/");
  if (parts.length > 1) {
    return parts.slice(0, -1).join("/");
  }
  return "";
}

import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, normalize, resolve } from "node:path";
import {
  buildApplicationFolderName,
  sanitizeFileName,
  sanitizeFolderName,
} from "../../src/shared/resumes.ts";

export interface SaveResumeInput {
  companyName: string;
  role: string;
  date?: string;
  sourcePath?: string;
  fileName?: string;
  fileBuffer?: ArrayBuffer | Uint8Array;
}

export interface SaveResumeResult {
  success: boolean;
  relativePath: string;
  fileName: string;
  folderPath: string;
  fullPath: string;
  error?: string;
}

export interface ResumesPathInfo {
  currentPath: string;
  defaultPath: string;
  isCustom: boolean;
}

export function getDefaultResumesRootDir(userDataPath: string): string {
  return join(userDataPath, "resumes");
}

export function getResumesRootDir(userDataPath: string, customPath?: string | null): string {
  const root =
    customPath && customPath.trim()
      ? resolve(customPath.trim())
      : getDefaultResumesRootDir(userDataPath);
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }
  return root;
}

export function getResumesPathInfo(userDataPath: string, customPath?: string | null): ResumesPathInfo {
  const defaultPath = getDefaultResumesRootDir(userDataPath);
  const currentPath = getResumesRootDir(userDataPath, customPath);
  const isCustom = Boolean(customPath && resolve(customPath.trim()) !== resolve(defaultPath));
  return {
    currentPath,
    defaultPath,
    isCustom,
  };
}

export function copyResumesDirectory(fromDir: string, toDir: string): void {
  if (!existsSync(fromDir)) return;
  const fromNorm = normalize(resolve(fromDir));
  const toNorm = normalize(resolve(toDir));
  if (fromNorm === toNorm) return;

  mkdirSync(toNorm, { recursive: true });
  const entries = readdirSync(fromNorm, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(fromNorm, entry.name);
    const dstPath = join(toNorm, entry.name);
    if (entry.isDirectory()) {
      copyResumesDirectory(srcPath, dstPath);
    } else if (entry.isFile()) {
      if (!existsSync(dstPath)) {
        copyFileSync(srcPath, dstPath);
      }
    }
  }
}

export function saveResumeFile(
  userDataPath: string,
  input: SaveResumeInput,
  customPath?: string | null,
): SaveResumeResult {
  const root = getResumesRootDir(userDataPath, customPath);
  const companyDir = sanitizeFolderName(input.companyName);
  const appFolderName = buildApplicationFolderName(input.role, input.date);
  const targetDir = join(root, companyDir, appFolderName);

  mkdirSync(targetDir, { recursive: true });

  const rawFileName =
    input.fileName || (input.sourcePath ? basename(input.sourcePath) : "resume.pdf");
  const fileName = sanitizeFileName(rawFileName);
  const destPath = join(targetDir, fileName);

  if (input.sourcePath && existsSync(input.sourcePath)) {
    copyFileSync(input.sourcePath, destPath);
  } else if (input.fileBuffer) {
    const buffer = Buffer.isBuffer(input.fileBuffer)
      ? input.fileBuffer
      : Buffer.from(input.fileBuffer as ArrayBuffer);
    writeFileSync(destPath, buffer);
  } else {
    throw new Error("No source file or buffer provided to saveResumeFile");
  }

  const relativePath = `${companyDir}/${appFolderName}/${fileName}`;

  return {
    success: true,
    relativePath,
    fileName,
    folderPath: targetDir,
    fullPath: destPath,
  };
}

export function resolveSafeResumePath(
  userDataPath: string,
  relativeOrFullPath: string,
  customPath?: string | null,
): string | null {
  const root = getResumesRootDir(userDataPath, customPath);
  const full = isAbsolute(relativeOrFullPath)
    ? normalize(relativeOrFullPath)
    : resolve(root, relativeOrFullPath);

  const rootNorm = normalize(root);
  const defaultRootNorm = normalize(getDefaultResumesRootDir(userDataPath));
  const userNorm = normalize(userDataPath);

  // Safe if inside active root, default root, or userData
  if (
    !full.startsWith(rootNorm) &&
    !full.startsWith(defaultRootNorm) &&
    !full.startsWith(userNorm)
  ) {
    return null;
  }
  return full;
}

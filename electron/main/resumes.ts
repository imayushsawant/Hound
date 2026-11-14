import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
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

export function getResumesRootDir(userDataPath: string): string {
  const root = join(userDataPath, "resumes");
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }
  return root;
}

export function saveResumeFile(
  userDataPath: string,
  input: SaveResumeInput,
): SaveResumeResult {
  const root = getResumesRootDir(userDataPath);
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
): string | null {
  const root = getResumesRootDir(userDataPath);
  const full = isAbsolute(relativeOrFullPath)
    ? normalize(relativeOrFullPath)
    : resolve(root, relativeOrFullPath);

  const rootNorm = normalize(root);
  const userNorm = normalize(userDataPath);
  if (!full.startsWith(rootNorm) && !full.startsWith(userNorm)) {
    return null;
  }
  return full;
}

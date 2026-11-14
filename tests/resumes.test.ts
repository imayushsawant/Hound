import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildApplicationFolderName,
  sanitizeFolderName,
  sanitizeFileName,
  buildResumeRelativePath,
  getResumeDisplayFileName,
  getResumeDisplayFolder,
} from "../src/shared/resumes.ts";
import {
  saveResumeFile,
  resolveSafeResumePath,
  getResumesRootDir,
} from "../electron/main/resumes.ts";

test("buildApplicationFolderName formats application-role-date correctly", () => {
  const folder = buildApplicationFolderName("Software Development Intern", "2026-11-14");
  assert.equal(folder, "application-software-development-intern-2026-11-14");

  const folderSpecial = buildApplicationFolderName("C++ / Backend Engineer (Intern)", "2026-11-14");
  assert.equal(folderSpecial, "application-c-backend-engineer-intern-2026-11-14");
});

test("sanitizeFolderName cleans invalid filesystem characters", () => {
  assert.equal(sanitizeFolderName("Stripe"), "Stripe");
  assert.equal(sanitizeFolderName("Stripe / Payments: <Global>*"), "Stripe  Payments Global");
  assert.equal(sanitizeFolderName(""), "General");
});

test("buildResumeRelativePath builds nested path for company and application", () => {
  const relPath = buildResumeRelativePath(
    "Stripe",
    "software development intern",
    "2026-11-14",
    "Stripe_Resume.pdf",
  );
  assert.equal(
    relPath,
    "Stripe/application-software-development-intern-2026-11-14/Stripe_Resume.pdf",
  );
});

test("getResumeDisplayFileName and getResumeDisplayFolder extract components", () => {
  const relPath = "Stripe/application-software-development-intern-2026-11-14/Stripe_Resume.pdf";
  assert.equal(getResumeDisplayFileName(relPath), "Stripe_Resume.pdf");
  assert.equal(
    getResumeDisplayFolder(relPath),
    "Stripe/application-software-development-intern-2026-11-14",
  );

  assert.equal(getResumeDisplayFileName("Simple_Resume.pdf"), "Simple_Resume.pdf");
  assert.equal(getResumeDisplayFolder("Simple_Resume.pdf"), "");
});

test("saveResumeFile creates nested folders and saves resume file", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "hound-resume-test-"));
  try {
    const fileContent = "Fake PDF content for resume";
    const buffer = Buffer.from(fileContent);

    // 1. Save resume for Application 1: Stripe - Software Development Intern
    const res1 = saveResumeFile(tempDir, {
      companyName: "Stripe",
      role: "software development intern",
      date: "2026-11-14",
      fileName: "Intern_Resume.pdf",
      fileBuffer: buffer,
    });

    assert.equal(res1.success, true);
    assert.equal(
      res1.relativePath,
      "Stripe/application-software-development-intern-2026-11-14/Intern_Resume.pdf",
    );
    assert.equal(existsSync(res1.fullPath), true);
    assert.equal(readFileSync(res1.fullPath, "utf-8"), fileContent);

    // 2. Save resume for Application 2: Stripe - Backend Engineer
    const res2 = saveResumeFile(tempDir, {
      companyName: "Stripe",
      role: "Backend Engineer",
      date: "2026-11-14",
      fileName: "Backend_Resume.pdf",
      fileBuffer: buffer,
    });

    assert.equal(res2.success, true);
    assert.equal(
      res2.relativePath,
      "Stripe/application-backend-engineer-2026-11-14/Backend_Resume.pdf",
    );
    assert.equal(existsSync(res2.fullPath), true);

    // Both folders exist inside Stripe folder!
    const stripeDir = join(tempDir, "resumes", "Stripe");
    assert.equal(
      existsSync(join(stripeDir, "application-software-development-intern-2026-11-14")),
      true,
    );
    assert.equal(
      existsSync(join(stripeDir, "application-backend-engineer-2026-11-14")),
      true,
    );

    // 3. Test copy from sourcePath
    const dummySrc = join(tempDir, "source-resume.docx");
    writeFileSync(dummySrc, "Docx file data");

    const res3 = saveResumeFile(tempDir, {
      companyName: "Google",
      role: "Frontend Engineer",
      date: "2026-11-14",
      sourcePath: dummySrc,
    });

    assert.equal(res3.success, true);
    assert.equal(
      res3.relativePath,
      "Google/application-frontend-engineer-2026-11-14/source-resume.docx",
    );
    assert.equal(existsSync(res3.fullPath), true);
    assert.equal(readFileSync(res3.fullPath, "utf-8"), "Docx file data");

    // 4. Test safe path resolution & path traversal protection
    const safePath = resolveSafeResumePath(tempDir, res1.relativePath);
    assert.equal(safePath, res1.fullPath);

    const maliciousPath = resolveSafeResumePath(tempDir, "../../etc/passwd");
    assert.equal(maliciousPath, null);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("user scenario: Stripe company with Software Development Intern application resume nested folder", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "hound-stripe-scenario-"));
  try {
    const resumeData = Buffer.from("My Software Development Intern Resume");
    const result = saveResumeFile(tempDir, {
      companyName: "Stripe",
      role: "software development intern",
      date: "2026-11-14",
      fileName: "Software_Dev_Intern_Resume.pdf",
      fileBuffer: resumeData,
    });

    assert.equal(
      result.relativePath,
      "Stripe/application-software-development-intern-2026-11-14/Software_Dev_Intern_Resume.pdf",
    );
    assert.equal(existsSync(result.fullPath), true);
    assert.equal(
      result.folderPath,
      join(tempDir, "resumes", "Stripe", "application-software-development-intern-2026-11-14"),
    );

    // Another application for Stripe:
    const result2 = saveResumeFile(tempDir, {
      companyName: "Stripe",
      role: "Site Reliability Engineer",
      date: "2026-11-14",
      fileName: "SRE_Resume.pdf",
      fileBuffer: Buffer.from("SRE Resume"),
    });

    assert.equal(
      result2.relativePath,
      "Stripe/application-site-reliability-engineer-2026-11-14/SRE_Resume.pdf",
    );
    assert.equal(existsSync(result2.fullPath), true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

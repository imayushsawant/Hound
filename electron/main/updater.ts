export interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseName?: string;
  releaseNotes?: string;
  publishedAt?: string;
  error?: string;
}

export function compareSemver(v1: string, v2: string): number {
  const clean = (s: string) => s.replace(/^v/i, "").trim();
  const p1 = clean(v1).split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
  const p2 = clean(v2).split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

export function isNewerVersion(current: string, latest: string): boolean {
  return compareSemver(latest, current) > 0;
}

export async function checkForUpdate(
  currentVersion: string,
  repo = "imayushsawant/Hound",
  fetchFn: typeof fetch = fetch,
): Promise<UpdateInfo> {
  const fallback: UpdateInfo = {
    updateAvailable: false,
    currentVersion,
    latestVersion: currentVersion,
    releaseUrl: `https://github.com/${repo}/releases`,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetchFn(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        "User-Agent": "Hound-Desktop-App",
        Accept: "application/vnd.github.v3+json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        ...fallback,
        error: `GitHub API returned status ${response.status}`,
      };
    }

    const data = (await response.json()) as any;
    const latestTag = typeof data.tag_name === "string" ? data.tag_name : "";
    const hasUpdate = Boolean(latestTag && isNewerVersion(currentVersion, latestTag));

    return {
      updateAvailable: hasUpdate,
      currentVersion,
      latestVersion: latestTag ? latestTag.replace(/^v/i, "") : currentVersion,
      releaseUrl: data.html_url || `https://github.com/${repo}/releases`,
      releaseName: data.name || latestTag,
      releaseNotes: data.body || "",
      publishedAt: data.published_at || "",
    };
  } catch (err: any) {
    return {
      ...fallback,
      error: err?.message || "Failed to check for updates",
    };
  }
}

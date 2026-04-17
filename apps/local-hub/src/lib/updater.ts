import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "available"; update: Update }
  | { phase: "downloading"; progress_pct: number }
  | { phase: "ready" }
  | { phase: "error"; message: string };

/** Check the configured endpoint for a newer version. */
export async function checkForUpdate(): Promise<Update | null> {
  return await check();
}

/** Download, install, and relaunch in one step. */
export async function downloadAndInstall(
  update: Update,
  onProgress: (pct: number) => void,
): Promise<void> {
  let total_bytes = 0;
  let downloaded_bytes = 0;

  await update.downloadAndInstall((event) => {
    if (event.event === "Started" && event.data.contentLength) {
      total_bytes = event.data.contentLength;
    } else if (event.event === "Progress") {
      downloaded_bytes += event.data.chunkLength;
      if (total_bytes > 0) {
        onProgress(Math.round((downloaded_bytes / total_bytes) * 100));
      }
    }
  });

  await relaunch();
}

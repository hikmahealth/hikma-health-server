import { useState, useEffect } from "react";
import {
  type UpdateStatus,
  checkForUpdate,
  downloadAndInstall,
} from "../lib/updater";

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export default function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus>({ phase: "idle" });

  useEffect(() => {
    runCheck();
    const id = setInterval(runCheck, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  async function runCheck() {
    setStatus({ phase: "checking" });
    try {
      const update = await checkForUpdate();
      if (update) {
        setStatus({ phase: "available", update });
      } else {
        setStatus({ phase: "idle" });
      }
    } catch (err) {
      setStatus({ phase: "error", message: String(err) });
    }
  }

  async function handleInstall() {
    if (status.phase !== "available") return;
    const { update } = status;
    setStatus({ phase: "downloading", progress_pct: 0 });
    try {
      await downloadAndInstall(update, (pct) =>
        setStatus({ phase: "downloading", progress_pct: pct }),
      );
      // relaunch happens inside downloadAndInstall — this line is unlikely to run
      setStatus({ phase: "ready" });
    } catch (err) {
      setStatus({ phase: "error", message: String(err) });
    }
  }

  if (status.phase === "idle" || status.phase === "checking") return null;

  if (status.phase === "error") {
    return (
      <div className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm rounded-md flex justify-between items-center">
        <span>Update check failed: {status.message}</span>
        <button onClick={runCheck} className="underline text-sm ml-2">
          Retry
        </button>
      </div>
    );
  }

  if (status.phase === "downloading") {
    return (
      <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm rounded-md">
        Downloading update... {status.progress_pct}%
      </div>
    );
  }

  if (status.phase === "available") {
    return (
      <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-sm rounded-md flex justify-between items-center">
        <span>
          Update available: v{status.update.version}
          {status.update.body ? ` — ${status.update.body}` : ""}
        </span>
        <button onClick={handleInstall} className="primary text-sm ml-2">
          Install & Restart
        </button>
      </div>
    );
  }

  return null;
}

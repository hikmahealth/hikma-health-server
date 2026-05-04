import { useState, useEffect, useReducer } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router";
import { QRCodeSVG } from "qrcode.react";
import ThemeToggle from "../components/ThemeToggle";
import UpdateBanner from "../components/UpdateBanner";
import { Input } from "../components/ui/Input";
import {
  serverReducer,
  initialServerState,
  formatSyncResult,
} from "../lib/server-state";
import { validateKeyRotation } from "../lib/validation";

// -- Component -----------------------------------------------------------

export default function Server() {
  const navigate = useNavigate();
  const [server, dispatch] = useReducer(serverReducer, initialServerState);
  const [pairingInfo, setPairingInfo] = useState<{
    hub_id: string;
    public_key: string;
    address: string;
  } | null>(null);

  // Database stats
  const [dbStats, setDbStats] = useState<{
    patients: number;
    visits: number;
    events: number;
  } | null>(null);

  // Approved clinics (per the cloud's devices.clinic_ids)
  const [authorizedClinics, setAuthorizedClinics] = useState<
    { id: string; name: string | null }[]
  >([]);

  // Cloud sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Key rotation state
  const [showKeyRotation, setShowKeyRotation] = useState(false);
  const [currentPassphrase, setCurrentPassphrase] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [confirmNewPassphrase, setConfirmNewPassphrase] = useState("");
  const [rotationLoading, setRotationLoading] = useState(false);

  // Clear all data state
  const [showClearData, setShowClearData] = useState(false);
  const [clearDataPassphrase, setClearDataPassphrase] = useState("");
  const [clearDataLoading, setClearDataLoading] = useState(false);
  const [clearDataResult, setClearDataResult] = useState<string | null>(null);

  // Get server status and database stats on mount
  useEffect(() => {
    checkServerStatus();
    fetchDatabaseStats();
    fetchAuthorizedClinics();
  }, []);

  const checkServerStatus = async () => {
    try {
      const [isRunning, address] =
        await invoke<[boolean, string | null]>("get_server_status");
      dispatch({ type: "STATUS_UPDATE", isRunning, address });
    } catch (err) {
      dispatch({
        type: "START_FAILURE",
        error: `Failed to get server status: ${err}`,
      });
    }
  };

  const fetchPairingInfo = async () => {
    try {
      const info = await invoke<{
        hub_id: string;
        public_key: string;
        address: string;
      }>("get_pairing_info");
      setPairingInfo(info);
    } catch {
      // Hub may not be registered yet — pairing info unavailable
      setPairingInfo(null);
    }
  };

  const fetchDatabaseStats = async () => {
    try {
      const [patients, visits, events] =
        await invoke<[number, number, number]>("get_database_stats");
      setDbStats({ patients, visits, events });
    } catch {
      setDbStats(null);
    }
  };

  const fetchAuthorizedClinics = async () => {
    try {
      const clinics =
        await invoke<{ id: string; name: string | null }[]>(
          "get_authorized_clinics",
        );
      setAuthorizedClinics(clinics);
    } catch {
      setAuthorizedClinics([]);
    }
  };

  const startServer = async () => {
    dispatch({ type: "START" });
    try {
      const result = await invoke<string>("start_server_command");
      const [isRunning, address] =
        await invoke<[boolean, string | null]>("get_server_status");
      dispatch({
        type: "START_SUCCESS",
        address: address ?? null,
        message: result,
      });
      if (isRunning) {
        await fetchPairingInfo();
        await fetchDatabaseStats();
      }
    } catch (err) {
      dispatch({
        type: "START_FAILURE",
        error: `Failed to start server: ${err}`,
      });
    }
  };

  const stopServer = async () => {
    dispatch({ type: "STOP" });
    try {
      await invoke<string>("stop_server_command");
      dispatch({ type: "STOP_SUCCESS" });
    } catch (err) {
      dispatch({
        type: "STOP_FAILURE",
        error: `Failed to stop server: ${err}`,
      });
    }
  };

  const lockDatabase = async () => {
    // Stop server first if running
    if (server.phase === "running") {
      dispatch({ type: "STOP" });
      try {
        await invoke<string>("stop_server_command");
        dispatch({ type: "STOP_SUCCESS" });
      } catch {
        // Continue to lock even if stop fails
      }
    }

    try {
      await invoke("lock_database");
      navigate("/");
    } catch (err) {
      dispatch({
        type: "STOP_FAILURE",
        error: `Failed to lock database: ${err}`,
      });
    }
  };

  const handleKeyRotation = async () => {
    const check = validateKeyRotation(
      currentPassphrase,
      newPassphrase,
      confirmNewPassphrase,
    );
    if (!check.valid) {
      dispatch({ type: "START_FAILURE", error: check.error });
      return;
    }

    dispatch({ type: "CLEAR_ERROR" });
    setRotationLoading(true);

    try {
      await invoke("rotate_encryption_key", {
        currentPassphrase,
        newPassphrase,
      });
      setShowKeyRotation(false);
      setCurrentPassphrase("");
      setNewPassphrase("");
      setConfirmNewPassphrase("");
    } catch (err) {
      dispatch({
        type: "START_FAILURE",
        error: `Failed to rotate key: ${err}`,
      });
    } finally {
      setRotationLoading(false);
    }
  };

  const syncWithCloud = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await invoke<{
        pulled_created: number;
        pulled_updated: number;
        pulled_deleted: number;
        pushed_created: number;
        pushed_updated: number;
        pushed_deleted: number;
        new_timestamp: number;
      }>("sync_with_cloud_command");
      setSyncResult(formatSyncResult(result));
      await fetchDatabaseStats();
      await fetchAuthorizedClinics();
    } catch (err) {
      dispatch({ type: "START_FAILURE", error: `Cloud sync failed: ${err}` });
    } finally {
      setSyncing(false);
    }
  };

  const handleClearAllData = async () => {
    if (!clearDataPassphrase) {
      dispatch({ type: "START_FAILURE", error: "Passphrase is required" });
      return;
    }

    dispatch({ type: "CLEAR_ERROR" });
    setClearDataLoading(true);
    setClearDataResult(null);

    try {
      const result = await invoke<{
        cleared: boolean;
        tables_cleared: number;
        rows_deleted: number;
      }>("clear_all_data", { passphrase: clearDataPassphrase });
      setClearDataResult(
        `Cleared ${result.rows_deleted} rows across ${result.tables_cleared} tables`,
      );
      setClearDataPassphrase("");
      setShowClearData(false);
      await fetchDatabaseStats();
    } catch (err) {
      dispatch({
        type: "START_FAILURE",
        error: `Failed to clear data: ${err}`,
      });
    } finally {
      setClearDataLoading(false);
    }
  };

  // Derived state for the template
  const isTransitional =
    server.phase === "starting" || server.phase === "stopping";
  const isRunning = server.phase === "running";

  return (
    <main className="container mx-auto">
      <UpdateBanner />
      <div className="flex justify-between items-center mb-4">
        <h1>Hikma Health Local Server</h1>
        <div className="flex gap-2 items-center">
          <ThemeToggle />
          <button onClick={lockDatabase} className="secondary text-sm">
            Lock & Exit
          </button>
        </div>
      </div>

      <div className="server-controls">
        <div className="status-display">
          <h2>Server Status</h2>
          <p>
            Status:{" "}
            <span className={isRunning ? "online" : "offline"}>
              {server.phase === "starting"
                ? "Starting..."
                : server.phase === "stopping"
                  ? "Stopping..."
                  : isRunning
                    ? "Online"
                    : "Offline"}
            </span>
          </p>
          {server.message && <p className="status-message">{server.message}</p>}
          {server.error && <p className="error-message">{server.error}</p>}
        </div>

        <div className="button-container">
          {isRunning ? (
            <button
              onClick={stopServer}
              disabled={isTransitional}
              className={isTransitional ? "disabled" : "danger"}
            >
              {server.phase === "stopping" ? "Stopping..." : "Stop Server"}
            </button>
          ) : (
            <button
              onClick={startServer}
              disabled={isTransitional}
              className={isTransitional ? "disabled" : "primary"}
            >
              {server.phase === "starting" ? "Starting..." : "Start Server"}
            </button>
          )}
          <button
            onClick={checkServerStatus}
            disabled={isTransitional}
            className="secondary"
          >
            Refresh Status
          </button>
          <button
            onClick={syncWithCloud}
            disabled={!isRunning || syncing}
            className={!isRunning || syncing ? "disabled" : "secondary"}
          >
            {syncing ? "Syncing..." : "Sync with Cloud"}
          </button>
        </div>
        {syncResult && <p className="status-message">{syncResult}</p>}
      </div>

      {server.address && (
        <div className="qr-container">
          <h2>Pair Device</h2>
          <p className="help-text">
            Scan this QR code with your mobile device to pair with this hub
          </p>
          <div className="qr-code">
            {pairingInfo ? (
              <>
                <QRCodeSVG
                  value={JSON.stringify({
                    type: "sync_hub",
                    url: pairingInfo.address,
                    id: pairingInfo.hub_id,
                    pk: pairingInfo.public_key,
                  })}
                  size={256}
                  fgColor="#111827"
                  bgColor="#ffffff"
                />
                <p className="text-sm text-gray-500 dark:text-zinc-500 mt-2">
                  Hub ID: {pairingInfo.hub_id.slice(0, 8)}...
                </p>
              </>
            ) : (
              <>
                <QRCodeSVG
                  value={server.address!}
                  size={256}
                  fgColor="#111827"
                  bgColor="#ffffff"
                />
                <p className="text-sm text-gray-500 dark:text-zinc-500 mt-2">
                  Device not registered — showing server address only
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* HUB Database quick stats */}
      {dbStats && (
        <div className="mt-6 p-4 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900">
          <h2 className="text-lg font-medium mb-3">Database Summary</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{dbStats.patients}</p>
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                Patients
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold">{dbStats.visits}</p>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Visits</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{dbStats.events}</p>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Events</p>
            </div>
          </div>
        </div>
      )}

      {/* Approved clinics — sourced from the cloud's devices.clinic_ids */}
      <div className="mt-6 p-4 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900">
        <h2 className="text-lg font-medium mb-3">Approved Clinics</h2>
        {authorizedClinics.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            No clinics configured for this hub. Ask your administrator to assign
            clinics to this device on the cloud server.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {authorizedClinics.map((c) => (
              <span
                key={c.id}
                title={c.id}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {c.name ?? c.id}
              </span>
            ))}
          </div>
        )}
      </div>


      {/* Key Rotation Section */}
      <div className="mt-8 p-4 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium">Security Settings</h2>
          <button
            onClick={() => setShowKeyRotation(!showKeyRotation)}
            className="secondary text-sm"
          >
            {showKeyRotation ? "Cancel" : "Change Passphrase"}
          </button>
        </div>

        {showKeyRotation && (
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-sm text-gray-600 dark:text-zinc-400">
              Rotate your encryption key by entering your current passphrase and
              a new one. The database will be re-encrypted with the new key.
            </p>

            <div className="flex flex-col gap-1">
              <label htmlFor="currentPass" className="text-sm font-medium">
                Current Passphrase
              </label>
              <Input
                id="currentPass"
                type="password"
                value={currentPassphrase}
                onChange={(e) => setCurrentPassphrase(e.target.value)}
                placeholder="Enter current passphrase"
                disabled={rotationLoading}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="newPass" className="text-sm font-medium">
                New Passphrase
              </label>
              <Input
                id="newPass"
                type="password"
                value={newPassphrase}
                onChange={(e) => setNewPassphrase(e.target.value)}
                placeholder="Enter new passphrase"
                disabled={rotationLoading}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="confirmNewPass" className="text-sm font-medium">
                Confirm New Passphrase
              </label>
              <Input
                id="confirmNewPass"
                type="password"
                value={confirmNewPassphrase}
                onChange={(e) => setConfirmNewPassphrase(e.target.value)}
                placeholder="Confirm new passphrase"
                disabled={rotationLoading}
              />
            </div>

            <button
              onClick={handleKeyRotation}
              className="primary"
              disabled={rotationLoading}
            >
              {rotationLoading ? "Rotating Key..." : "Rotate Encryption Key"}
            </button>
          </div>
        )}

        <hr className="my-4 border-gray-200 dark:border-zinc-700" />

        {/* Clear All Data */}
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-medium text-red-700 dark:text-red-400">
              Clear All Data
            </h3>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Permanently delete all patient, clinical, and sync data from this
              hub
            </p>
          </div>
          <button
            onClick={() => {
              setShowClearData(!showClearData);
              setClearDataPassphrase("");
              setClearDataResult(null);
            }}
            className="danger text-sm"
          >
            {showClearData ? "Cancel" : "Clear Data"}
          </button>
        </div>

        {clearDataResult && (
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            {clearDataResult}
          </p>
        )}

        {showClearData && (
          <div className="mt-4 flex flex-col gap-4 p-3 border border-red-300 dark:border-red-800 rounded-md bg-red-50 dark:bg-red-950">
            <p className="text-sm text-red-700 dark:text-red-300">
              This action is irreversible. All local data will be permanently
              deleted. Enter your passphrase to confirm.
            </p>

            <div className="flex flex-col gap-1">
              <label htmlFor="clearDataPass" className="text-sm font-medium">
                Passphrase
              </label>
              <Input
                id="clearDataPass"
                type="password"
                value={clearDataPassphrase}
                onChange={(e) => setClearDataPassphrase(e.target.value)}
                placeholder="Enter your passphrase to confirm"
                disabled={clearDataLoading}
              />
            </div>

            <button
              onClick={handleClearAllData}
              className="danger"
              disabled={clearDataLoading || !clearDataPassphrase}
            >
              {clearDataLoading
                ? "Clearing..."
                : "Permanently Delete All Data"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

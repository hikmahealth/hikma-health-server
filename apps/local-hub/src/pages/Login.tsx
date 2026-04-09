import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { invoke } from "@tauri-apps/api/core";
import ThemeToggle from "../components/ThemeToggle";
import { Input } from "../components/ui/Input";
import { validateNewPassphrase } from "../lib/validation";

interface EncryptionStatus {
  database_exists: boolean;
  is_encrypted: boolean;
  is_unlocked: boolean;
}

export default function Login() {
  const navigate = useNavigate();
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [encryptionStatus, setEncryptionStatus] =
    useState<EncryptionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check registration and encryption status on mount
  useEffect(() => {
    checkRegistrationThenEncryption();
  }, []);

  const checkRegistrationThenEncryption = async () => {
    try {
      const isRegistered = await invoke<boolean>("check_device_registration");
      if (!isRegistered) {
        navigate("/register");
        return;
      }

      const status = await invoke<EncryptionStatus>("get_encryption_status");
      setEncryptionStatus(status);

      if (status.is_unlocked) {
        navigate("/server");
      }
    } catch (err) {
      setError(`Failed to check status: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!passphrase) {
      setError("Please enter your passphrase");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await invoke("unlock_database", { passphrase });
      navigate("/server");
    } catch (err) {
      setError(`Failed to unlock: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInitialize = async () => {
    const check = validateNewPassphrase(passphrase, confirmPassphrase);
    if (!check.valid) {
      setError(check.error);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await invoke("initialize_encryption", { passphrase });
      navigate("/server");
    } catch (err) {
      setError(`Failed to initialize encryption: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Determine if this is first-time setup (no encrypted DB exists)
  const isFirstTimeSetup = encryptionStatus && !encryptionStatus.is_encrypted;

  if (loading && !encryptionStatus) {
    return (
      <main className="container">
        <h1>Hikma Health Local Hub</h1>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="container mx-auto">
      <div className="flex justify-end mb-2">
        <ThemeToggle />
      </div>
      <h1>Hikma Health Local Hub</h1>
      <div className="login-form">
        <h2>{isFirstTimeSetup ? "Setup Encryption" : "Unlock Database"}</h2>

        {isFirstTimeSetup && (
          <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">
            Create a passphrase to encrypt your local database. This passphrase
            will be required each time you start the application.
          </p>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="passphrase" className="text-sm font-medium">
              {isFirstTimeSetup ? "Create Passphrase" : "Passphrase"}
            </label>
            <Input
              id="passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isFirstTimeSetup) {
                  handleUnlock();
                }
              }}
              placeholder={
                isFirstTimeSetup
                  ? "Create a secure passphrase"
                  : "Enter your passphrase"
              }
              disabled={loading}
            />
          </div>

          {isFirstTimeSetup && (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="confirmPassphrase"
                className="text-sm font-medium"
              >
                Confirm Passphrase
              </label>
              <Input
                id="confirmPassphrase"
                type="password"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleInitialize();
                  }
                }}
                placeholder="Confirm your passphrase"
                disabled={loading}
              />
            </div>
          )}

          {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
        </div>

        <div className="button-container">
          <button
            onClick={isFirstTimeSetup ? handleInitialize : handleUnlock}
            className="primary"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isFirstTimeSetup
                ? "Initialize Encryption"
                : "Unlock"}
          </button>
        </div>
      </div>
    </main>
  );
}

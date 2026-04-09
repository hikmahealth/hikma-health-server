import { useState } from "react";
import { useNavigate } from "react-router";
import { invoke } from "@tauri-apps/api/core";
import ThemeToggle from "../components/ThemeToggle";
import { Input } from "../components/ui/Input";
import { validateRegistration } from "../lib/validation";

export default function DeviceRegistration() {
  const navigate = useNavigate();
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const check = validateRegistration(serverUrl, apiKey);
    if (!check.valid) {
      setError(check.error);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await invoke("register_device", {
        apiKey: apiKey.trim(),
        serverUrl: serverUrl.trim(),
      });
      navigate("/");
    } catch (err) {
      setError(`${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto flex flex-col items-center justify-center">
      <div className="flex justify-end w-full mb-2">
        <ThemeToggle />
      </div>
      <h1>Hikma Health Local Hub</h1>
      <div className="login-form">
        <h2>Register Device here</h2>

        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">
          Connect this hub to your Hikma Health cloud server. Enter the server
          URL and the API key provided by your administrator.
        </p>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="serverUrl" className="text-sm font-medium">
              Cloud Server URL
            </label>
            <Input
              id="serverUrl"
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://your-server.hikmahealth.org"
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="apiKey" className="text-sm font-medium">
              API Key
            </label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRegister();
                }
              }}
              placeholder="Enter your API key"
              disabled={loading}
            />
          </div>

          {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
        </div>

        <div className="button-container">
          <button
            onClick={handleRegister}
            className="primary"
            disabled={loading}
          >
            {loading ? "Verifying..." : "Register Device"}
          </button>
        </div>
      </div>
    </main>
  );
}

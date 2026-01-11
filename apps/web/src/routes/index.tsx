import { createFileRoute, redirect } from "@tanstack/react-router";
import { Button } from "@hh/ui/components/button";
import { Input } from "@hh/ui/components/input";
import { Label } from "@hh/ui/components/label";
import { useCallback, useState } from "react";
import { checkIsTokenValid, signIn } from "@/platform/functions/authstate";

// import { Pool } from "pg"
// import Clinic from '@/models/clinic'

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { isValid } = await checkIsTokenValid();
    if (isValid) {
      throw redirect({ to: "/app" });
    }
  },
  component: Login,
});

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(false);

  const navigate = Route.useNavigate();

  const handleLogin = useCallback(() => {
    setLoadingAuth(true);
    signIn({ data: { email, password } })
      .then(() => {
        navigate({ to: "/app" });
      })
      .catch((err) => {
        console.error(err);
        alert(err.message);
      })
      .finally(() => {
        setLoadingAuth(false);
      });
  }, [email, password]);

  return (
    <div className="container mx-auto flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md">
        <h1 className="text-center text-2xl font-bold mb-8">
          Hikma Health Administrators
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                data-testid="email-input"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hikmahealth.org"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                data-testid="password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <div
                role="checkbox"
                aria-checked={remember}
                tabIndex={0}
                className={`h-4 w-4 border rounded cursor-pointer flex items-center justify-center ${remember ? "bg-primary border-primary" : "border-gray-300"}`}
                onClick={() => setRemember(!remember)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setRemember(!remember);
                  }
                }}
              >
                {remember && <span className="text-white text-xs">✓</span>}
              </div>
              <Label
                htmlFor="remember"
                className="text-sm cursor-pointer"
                onClick={() => setRemember(!remember)}
              >
                Remember me
              </Label>
            </div>

            <Button
              id="login-button"
              disabled={loadingAuth}
              onClick={handleLogin}
              className="w-full"
            >
              {loadingAuth ? "Signing in..." : "Sign in"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

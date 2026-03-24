import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/education")({
  component: EducationLayout,
});

function EducationLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center">
          <a href="/" className="flex items-center gap-2">
            <img src="/logo187.png" alt="Hikma Health" className="h-8 w-8" />
            <span className="font-semibold text-lg">Hikma Health</span>
          </a>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

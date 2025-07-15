import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
export const Route = createFileRoute("/app/settings/register-mobile-app")({
  component: RouteComponent,
});

function RouteComponent() {
  // the code is the current URL base URL
  const code = window.location.origin;
  return (
    <div>
      <QRCodeSVG
        style={{ padding: 20 }}
        bgColor={"#fff"}
        value={code}
        level="M"
        size={400}
        marginSize={4}
      />
    </div>
  );
}

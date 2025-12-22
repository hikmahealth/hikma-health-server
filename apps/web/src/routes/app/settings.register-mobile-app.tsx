import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
export const Route = createFileRoute("/app/settings/register-mobile-app")({
  component: RouteComponent,
});

function RouteComponent() {
  // the code is the current URL base URL
  const { hostname, protocol, origin } = window.location;
  // const code = `${protocol}//${hostname}`;
  const code = origin;
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Register Mobile App</h1>
      <p className="mb-6">
        Scan the QR code with the mobile app to register it.
      </p>
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

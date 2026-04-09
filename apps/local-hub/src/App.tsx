import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import Login from "./pages/Login";
import Server from "./pages/Server";
import DeviceRegistration from "./pages/DeviceRegistration";

import "./App.css";

function initializeTheme() {
  const stored = localStorage.getItem("theme");
  if (stored === "dark") {
    document.documentElement.classList.add("dark");
  } else if (stored === "light") {
    document.documentElement.classList.remove("dark");
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.classList.add("dark");
  }
}

function App() {
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<DeviceRegistration />} />
        <Route path="/server" element={<Server />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

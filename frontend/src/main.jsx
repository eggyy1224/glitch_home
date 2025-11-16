import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ClientDashboard from "./ClientDashboard.jsx";

const params = new URLSearchParams(window.location.search);
const dashboardFlag = params.get("dashboard") ?? params.get("dashboard_mode");
const isDashboard = typeof dashboardFlag === "string" && dashboardFlag.toLowerCase() === "true";

createRoot(document.getElementById("root")).render(isDashboard ? <ClientDashboard /> : <App />);



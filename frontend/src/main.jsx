import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { AppModeProvider } from "./appMode/AppModeContext.jsx";

createRoot(document.getElementById("root")).render(
  <AppModeProvider>
    <App />
  </AppModeProvider>,
);


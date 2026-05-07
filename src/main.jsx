import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./storage.js";
import DietManager from "./DietManager.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <DietManager />
  </StrictMode>,
);

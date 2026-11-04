import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import BrandHeader from "./brand/BrandHeader";

const container = document.getElementById("root");

if (!container) {
  throw new Error('Missing required React root element: "#root".');
}

createRoot(container).render(
  <React.StrictMode>
    <>
      <BrandHeader />
      <App />
    </>
  </React.StrictMode>
);

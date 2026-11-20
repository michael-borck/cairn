import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const UpdateBanner = lazy(() => import("./UpdateBanner"));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <UpdateBanner />
    </Suspense>
    <App />
  </React.StrictMode>,
);

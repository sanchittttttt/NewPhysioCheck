import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

// Note: We keep auth data in localStorage so users stay logged in
// Only clear on explicit sign out

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
    </BrowserRouter>
  </AuthProvider>
);


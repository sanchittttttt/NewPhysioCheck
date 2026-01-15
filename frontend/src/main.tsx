import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext";
import { ProtocolProvider } from "./context/ProtocolContext";
import { SessionProvider } from "./context/SessionContext";
import { MessageProvider } from "./context/MessageContext";
import { NotificationProvider } from "./context/NotificationContext";
import "./index.css";

// Note: We keep auth data in localStorage so users stay logged in
// Only clear on explicit sign out

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <ProtocolProvider>
      <SessionProvider>
        <MessageProvider>
          <NotificationProvider>
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <App />
            </BrowserRouter>
          </NotificationProvider>
        </MessageProvider>
      </SessionProvider>
    </ProtocolProvider>
  </AuthProvider>
);


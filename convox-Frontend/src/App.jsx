import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import { ChatRequestProvider } from "./context/ChatRequestContext.jsx";

const AuthCallback = lazy(() => import("./pages/AuthCallback.jsx"));
const Chat = lazy(() => import("./pages/Chat.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Signup = lazy(() => import("./pages/Signup.jsx"));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route
            path="/login"
            element={(
              <PublicRoute>
                <Login />
              </PublicRoute>
            )}
          />
          <Route
            path="/signup"
            element={(
              <PublicRoute>
                <Signup />
              </PublicRoute>
            )}
          />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/chat"
            element={(
              <ProtectedRoute>
                <ChatRequestProvider>
                  <Chat />
                </ChatRequestProvider>
              </ProtectedRoute>
            )}
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;

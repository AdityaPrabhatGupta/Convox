import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { isLoggedIn, refreshAccessToken } from "../utils/auth";

const ProtectedRoute = ({ children }) => {
  const [status, setStatus] = useState(() => (isLoggedIn() ? "ready" : "checking"));

  useEffect(() => {
    let active = true;

    if (isLoggedIn()) {
      setStatus("ready");
      return () => {
        active = false;
      };
    }

    refreshAccessToken().then((refreshed) => {
      if (!active) return;
      setStatus(refreshed ? "ready" : "denied");
    });

    return () => {
      active = false;
    };
  }, []);

  if (status === "checking") {
    return null;
  }

  return status === "ready" ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;

import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { isLoggedIn, refreshAccessToken } from "../utils/auth";

const PublicRoute = ({ children }) => {
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
      setStatus(refreshed ? "ready" : "guest");
    });

    return () => {
      active = false;
    };
  }, []);

  if (status === "checking") {
    return null;
  }

  return status === "ready" ? <Navigate to="/chat" replace /> : children;
};

export default PublicRoute;

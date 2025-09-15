import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider, Navigate } from "react-router-dom";
import InvitationPage from "./InvitationPage.jsx";
import MatchPage from "./pages/MatchPage.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import TennisMatchCreatorComplete from "./pages/TennisMatchCreatorComplete.jsx";
import TennisMatchApp from "./TennisMatchApp.jsx"; // keep your existing home/app

const router = createHashRouter([
  // App home
  { path: "/", element: <TennisMatchApp /> },
  { path: "/creator", element: <TennisMatchCreatorComplete /> },

  // Match details (direct link)
  { path: "/matches/:id", element: <MatchPage /> },

  // Private invite OTP flow
  { path: "/invites/:token", element: <InvitationPage /> },
  // Backward-compatible aliases
  { path: "/i/:token", element: <InvitationPage /> },
  { path: "/m/:token", element: <InvitationPage /> },

  // Password reset
  { path: "/reset-password/:token", element: <ResetPassword /> },

  // Fallback: redirect unknown routes to home
  { path: "*", element: <Navigate to="/" replace /> },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

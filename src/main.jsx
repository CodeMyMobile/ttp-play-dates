import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import InvitationPage from "./InvitationPage.jsx";
import MatchPage from "./pages/MatchPage.jsx";
import TennisMatchApp from "./TennisMatchApp.jsx"; // keep your existing home/app

const router = createHashRouter([
  { path: "/", element: <TennisMatchApp /> },
  { path: "/i/:token", element: <InvitationPage /> },
  { path: "/matches/:id", element: <MatchPage /> },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

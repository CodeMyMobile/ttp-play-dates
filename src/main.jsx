import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import InvitePage from "./pages/InvitePage.jsx";
import MatchPage from "./pages/MatchPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import "./index.css";

const router = createBrowserRouter([
  { path: "/i/:token/*", element: <InvitePage /> },
  { path: "/matches/:id/*", element: <MatchPage /> },
  { path: "*", element: <NotFoundPage /> },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

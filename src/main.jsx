import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import TennisMatchApp from "./TennisMatchApp.jsx";
import InvitePage from "./pages/InvitePage.jsx";
import MatchPage from "./pages/MatchPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import "./index.css";

const router = createBrowserRouter(
  [
    { path: "/", element: <TennisMatchApp /> },
    { path: "/i/:token/*", element: <InvitePage /> },
    { path: "/matches/:id/*", element: <MatchPage /> },
    { path: "*", element: <NotFoundPage /> },
  ],
  {
    // Align router paths with the Vite base so links work under /ttp-play-dates/,
    // but use root basename in dev for local testing.
    basename: import.meta.env.DEV ? "/" : import.meta.env.BASE_URL,
  },
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

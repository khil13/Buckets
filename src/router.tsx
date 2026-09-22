import { createHashRouter } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Slate } from "./pages/Slate";
import { GameDetail } from "./pages/GameDetail";
import { PropBoard } from "./pages/PropBoard";
import { PlayerDetail } from "./pages/PlayerDetail";

// Hash routing avoids needing server-side rewrites for a client-rendered
// SPA — required on GitHub Pages (a static host with no rewrite rules).
// Switch to createBrowserRouter (paired with netlify.toml's existing SPA
// redirect) if/when this moves to Netlify.
export const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Slate /> },
      { path: "/game/:gameId", element: <GameDetail /> },
      { path: "/props", element: <PropBoard /> },
      { path: "/player/:playerId", element: <PlayerDetail /> },
    ],
  },
]);

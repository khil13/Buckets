import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Slate } from "./pages/Slate";
import { GameDetail } from "./pages/GameDetail";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Slate /> },
      { path: "/game/:gameId", element: <GameDetail /> },
    ],
  },
]);

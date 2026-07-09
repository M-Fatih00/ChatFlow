import { createBrowserRouter } from "react-router-dom";
import LoginPage from "../features/auth/LoginPage";
import App from "../layouts/App";
import HomePage from "../features/home/HomePage";
import RegisterPage from "../features/auth/RegisterPage";
import NotFound from "../features/errors/NotFound";
import ServerError from "../features/errors/ServerError";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { path: "", element: <HomePage /> },
      { path: "chat/:conversationId", element: <HomePage /> },
      { path: "room/:roomId", element: <HomePage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "not-found", element: <NotFound /> },
      { path: "server-error", element: <ServerError /> },

      { path: "*", element: <NotFound /> },
    ],
  },
]);

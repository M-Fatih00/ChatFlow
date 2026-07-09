import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/store";
import { getMe } from "../features/auth/authSlice";
import { signalRService } from "../api/signalRService";
import { message } from "antd";
import "../Index.css";
import { clearActiveConversation } from "../features/chats/chatSlice";

function App() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, status, token } = useAppSelector(
    (state) => state.auth,
  );

  useEffect(() => {
    dispatch(getMe());
  }, []); // sadece bir kez çalışsın

  useEffect(() => {
    if (status === "ready" && !isAuthenticated) {
      navigate("/login");
    }

    if (status === "ready" && isAuthenticated && token) {
      signalRService.connect(token);
    }
  }, [status, isAuthenticated, token]);

  useEffect(() => {
    const handleRemovedFromRoom = () => {
      dispatch(clearActiveConversation());
      message.warning("Bu gruptan çıkarıldınız");
      navigate("/");
    };

    window.addEventListener("removedFromRoom", handleRemovedFromRoom);
    return () =>
      window.removeEventListener("removedFromRoom", handleRemovedFromRoom);
  }, [navigate, dispatch]);

  if (status === "loading" || status === "idle") {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#f5f5f5",
        }}
      >
        <div className="app-spinner" />
        <span style={{ color: "#888", fontSize: 14 }}>Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div>
      <Outlet />
    </div>
  );
}

export default App;

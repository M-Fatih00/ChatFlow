import { useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/store";
import { getMe } from "../features/auth/authSlice";
import { signalRService } from "../api/signalRService";
import { message, Modal } from "antd";
import "../index.css";
import { clearActiveConversation } from "../features/chats/chatSlice";

function App() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { isAuthenticated, status, token } = useAppSelector(
    (state) => state.auth,
  );

  const { activeConversationId } = useAppSelector((state) => state.chat);

  const activeConvRef = useRef(activeConversationId);
  activeConvRef.current = activeConversationId;

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

  // Geri tuşu: sohbet açıksa kapat, değilse çıkış onayı
  useEffect(() => {
    if (!(status === "ready" && isAuthenticated)) return;

    window.history.pushState(null, "", window.location.href);

    let confirmOpen = false;
    const handlePopState = () => {
      // Her geri tuşunda önce buffer'ı yenile (istemsiz çıkışı engelle)
      window.history.pushState(null, "", window.location.href);

      // Sohbet açıksa → kapat, listeye dön
      if (activeConvRef.current != null) {
        dispatch(clearActiveConversation());
        navigate("/");
        return;
      }

      // Sohbet kapalı → çıkış onayı
      if (confirmOpen) return;
      confirmOpen = true;
      Modal.confirm({
        title: "Uygulamadan Çık",
        content: "Uygulamadan çıkmak istediğinize emin misiniz?",
        okText: "Çık",
        okType: "danger",
        cancelText: "İptal",
        onOk: () => {
          confirmOpen = false;
          window.removeEventListener("popstate", handlePopState);
          window.history.go(-2);
        },
        onCancel: () => {
          confirmOpen = false;
        },
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [status, isAuthenticated]);

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

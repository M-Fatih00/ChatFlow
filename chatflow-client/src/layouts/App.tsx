import { useEffect } from "react";
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

  // Geri tuşuna basınca uygulamadan çıkmasın, çıkış onayı sorsun
  useEffect(() => {
    // Sadece giriş yapmış kullanıcıda aktif olsun
    if (!(status === "ready" && isAuthenticated)) return;

    // History'ye bir durum ekledik (geri tuşu yakalanabilsin diye)
    window.history.pushState(null, "", window.location.href);

    let confirmOpen = false;

    const handlePopState = () => {
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
          // Kullanıcıyı gerçekten geri götür (uygulamadan çık)
          window.removeEventListener("popstate", handlePopState);
          window.history.back();
        },
        onCancel: () => {
          confirmOpen = false;
          // Kullanıcıyı uygulamada tut (tekrar durum ekle)
          window.history.pushState(null, "", window.location.href);
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
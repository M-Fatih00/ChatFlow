import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/store";
import { getMe, logoutUser } from "../features/auth/authSlice";
import { signalRService } from "../api/signalRService";
import { message, Modal } from "antd";
import "../index.css";
import { clearActiveConversation } from "../features/chats/chatSlice";

function App() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

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

  // Geri tuşu: SADECE ana sayfada (/) çıkış onayı sor.
  // Sohbet sayfasında (/chat, /room) dinleyici kurulmaz → geri doğal çalışır,
  // react-router listeye döndürür, çıkış SORULMAZ.
  useEffect(() => {
    if (!(status === "ready" && isAuthenticated)) return;

    const path = location.pathname;
    const isOnHome = path === "/" || path === "";
    if (!isOnHome) return;

    // Geri tuşunu yakalamak için buffer ekle
    window.history.pushState(null, "", window.location.href);

    let confirmOpen = false;

    const handlePopState = () => {
      // Modal zaten açıksa, buffer'ı yenile ve çık (çift modal olmasın)
      if (confirmOpen) {
        window.history.pushState(null, "", window.location.href);
        return;
      }

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
          dispatch(logoutUser());
        },
        onCancel: () => {
          confirmOpen = false;
          // Kullanıcı kaldı → yeni buffer ekle ki bir sonraki geri tuşu da yakalansın
          window.history.pushState(null, "", window.location.href);
        },
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [status, isAuthenticated, location.pathname, dispatch]);

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
import { useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/store";
import { getMe } from "../features/auth/authSlice";
import { signalRService } from "../api/signalRService";
import { message, Modal } from "antd";
import { clearActiveConversation } from "../features/chats/chatSlice";
import { logoutUser } from "../features/auth/authSlice";
import "../index.css";

function App() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { isAuthenticated, status, token } = useAppSelector(
    (state) => state.auth,
  );

  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

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

  // Geri tuşu: SADECE ana sayfadayken (/) çıkış onayı sor.
  // Sohbetteyken (/chat/... veya /room/...) karışma — react-router zaten listeye döndürür.
  useEffect(() => {
    if (!(status === "ready" && isAuthenticated)) return;

    let confirmOpen = false;

    const handlePopState = () => {
      const path = pathRef.current;
      const onHomePage = path === "/" || path === "";

      // Sohbet/oda sayfasındaysak: react-router zaten "/"'a döndürüyor.
      // Biz karışmıyoruz — sohbet listesine dönsün, çıkış SORMA.
      if (!onHomePage) {
        return;
      }

      // Ana sayfadayız çıkış onayı
      window.history.pushState(null, "", window.location.href);
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
          dispatch(logoutUser());
        },
        onCancel: () => {
          confirmOpen = false;
        },
      });
    };

    // Ana sayfadaysak baştan bir buffer ekle (ilk geri tuşunu yakalayabilmek için)
    if (pathRef.current === "/" || pathRef.current === "") {
      window.history.pushState(null, "", window.location.href);
    }

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

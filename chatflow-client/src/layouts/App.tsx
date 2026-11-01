import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { message, Modal } from "antd";
import { useAppDispatch, useAppSelector } from "../store/store";
import { getMe, logoutUser } from "../features/auth/authSlice";
import { clearActiveConversation } from "../features/chats/chatSlice";
import { signalRService } from "../api/signalRService";
import "../index.css";
import "../components/Animate/Animate.css";

const PUBLIC_PATHS = ["/login", "/register"];

function App() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { isAuthenticated, status } = useAppSelector((state) => state.auth);
  const isPublicPath = PUBLIC_PATHS.includes(location.pathname);

  useEffect(() => {
    dispatch(getMe());
  }, [dispatch]);

  useEffect(() => {
    if (status !== "ready") return;

    if (!isAuthenticated && !isPublicPath) {
      navigate("/login", { replace: true });
      return;
    }

    if (isAuthenticated && isPublicPath) {
      navigate("/", { replace: true });
    }
  }, [status, isAuthenticated, isPublicPath, navigate]);

  useEffect(() => {
    if (status !== "ready" || !isAuthenticated) return;

    signalRService.connect().catch(() => {
      message.error("Anlık bağlantı kurulamadı. Sayfayı yenilemeyi deneyin.");
    });

    const timer = setTimeout(
      () => window.dispatchEvent(new Event("resize")),
      100,
    );
    return () => clearTimeout(timer);
  }, [status, isAuthenticated]);

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

  useEffect(() => {
    if (!(status === "ready" && isAuthenticated)) return;

    const path = location.pathname;
    const isOnHome = path === "/" || path === "";
    if (!isOnHome) return;

    window.history.pushState(null, "", window.location.href);

    let confirmOpen = false;

    const handlePopState = () => {
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
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "var(--color-auth-bg, #f5f5f5)",
        }}
      >
        <div className="app-spinner" />
        <span style={{ color: "#888", fontSize: 14 }}>Yükleniyor...</span>
      </div>
    );
  }

  return (
    <div key={isPublicPath ? location.pathname : "app"} className="anim anim-fade">
      <Outlet />
    </div>
  );
}

export default App;
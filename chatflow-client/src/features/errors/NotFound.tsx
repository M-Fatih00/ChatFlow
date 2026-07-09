import { useNavigate } from "react-router-dom";
import { Button } from "antd";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8faf9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{`
        @keyframes float-404 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
        @keyframes pulse-404 {
          0% { transform: scale(0.85); opacity: 0.5; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes fade-in-404 {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .nf-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          animation: fade-in-404 0.6s ease both;
          text-align: center;
          padding: 24px;
        }
        .nf-icon-area {
          position: relative;
          width: 130px;
          height: 130px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 32px;
        }
        .nf-pulse {
          position: absolute;
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: #166534;
          opacity: 0;
          animation: pulse-404 2.6s ease-out infinite;
        }
        .nf-pulse:nth-child(2) { animation-delay: 0.9s; }
        .nf-pulse:nth-child(3) { animation-delay: 1.8s; }
        .nf-circle {
          position: relative;
          width: 88px;
          height: 88px;
          background: #166534;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: float-404 3s ease-in-out infinite;
          z-index: 1;
          font-size: 36px;
        }
        .nf-number {
          font-size: 96px;
          font-weight: 800;
          color: #166534;
          line-height: 1;
          letter-spacing: -4px;
          margin-bottom: 16px;
          opacity: 0.15;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          user-select: none;
        }
        .nf-title {
          font-size: 22px;
          font-weight: 600;
          color: #222;
          margin: 0 0 10px;
        }
        .nf-subtitle {
          font-size: 15px;
          color: #888;
          max-width: 280px;
          line-height: 1.6;
          margin: 0 0 32px;
        }
        .nf-dots {
          display: flex;
          gap: 6px;
          margin-bottom: 32px;
        }
        .nf-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #166534;
          opacity: 0.3;
          animation: blink 1.4s ease-in-out infinite;
        }
        .nf-dot:nth-child(2) { animation-delay: 0.2s; }
        .nf-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      <div className="nf-wrap">
        <div className="nf-icon-area" style={{ position: "relative" }}>
          <div className="nf-pulse" />
          <div className="nf-pulse" />
          <div className="nf-pulse" />
          <div className="nf-circle">🔍</div>
          <span className="nf-number">404</span>
        </div>

        <h1 className="nf-title">Sayfa Bulunamadı</h1>
        <p className="nf-subtitle">
          Aradığınız sayfa mevcut değil ya da taşınmış olabilir.
        </p>

        <div className="nf-dots">
          <div className="nf-dot" />
          <div className="nf-dot" />
          <div className="nf-dot" />
        </div>

        <Button
          type="primary"
          size="large"
          onClick={() => navigate("/")}
          style={{
            background: "#166534",
            borderColor: "#166534",
            borderRadius: 10,
            height: 46,
            paddingInline: 32,
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Ana Sayfaya Dön
        </Button>
      </div>
    </div>
  );
}
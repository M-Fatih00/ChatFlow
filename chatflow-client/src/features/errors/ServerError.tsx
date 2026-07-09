import { useNavigate } from "react-router-dom";
import { Button } from "antd";

export default function ServerError() {
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
        @keyframes shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          15% { transform: translateX(-6px) rotate(-3deg); }
          30% { transform: translateX(6px) rotate(3deg); }
          45% { transform: translateX(-4px) rotate(-2deg); }
          60% { transform: translateX(4px) rotate(2deg); }
          75% { transform: translateX(-2px) rotate(-1deg); }
          90% { transform: translateX(2px) rotate(1deg); }
        }
        @keyframes pulse-500 {
          0% { transform: scale(0.85); opacity: 0.4; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes fade-in-500 {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .se-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          animation: fade-in-500 0.6s ease both;
          text-align: center;
          padding: 24px;
        }
        .se-icon-area {
          position: relative;
          width: 130px;
          height: 130px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 32px;
        }
        .se-pulse {
          position: absolute;
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: #dc2626;
          opacity: 0;
          animation: pulse-500 2.6s ease-out infinite;
        }
        .se-pulse:nth-child(2) { animation-delay: 0.9s; }
        .se-pulse:nth-child(3) { animation-delay: 1.8s; }
        .se-circle {
          position: relative;
          width: 88px;
          height: 88px;
          background: #dc2626;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: shake 2.5s ease-in-out infinite;
          animation-delay: 1s;
          z-index: 1;
          font-size: 36px;
        }
        .se-number {
          font-size: 96px;
          font-weight: 800;
          color: #dc2626;
          line-height: 1;
          letter-spacing: -4px;
          margin-bottom: 16px;
          opacity: 0.12;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          user-select: none;
        }
        .se-title {
          font-size: 22px;
          font-weight: 600;
          color: #222;
          margin: 0 0 10px;
        }
        .se-subtitle {
          font-size: 15px;
          color: #888;
          max-width: 300px;
          line-height: 1.6;
          margin: 0 0 32px;
        }
        .se-gear {
          font-size: 22px;
          display: inline-block;
          animation: spin-slow 3s linear infinite;
          margin-bottom: 28px;
          opacity: 0.4;
        }
      `}</style>

      <div className="se-wrap">
        <div className="se-icon-area" style={{ position: "relative" }}>
          <div className="se-pulse" />
          <div className="se-pulse" />
          <div className="se-pulse" />
          <div className="se-circle">⚡</div>
          <span className="se-number">500</span>
        </div>

        <h1 className="se-title">Sunucu Hatası</h1>
        <p className="se-subtitle">
          Beklenmedik bir hata oluştu. Lütfen birkaç saniye bekleyip tekrar deneyin.
        </p>

        <span className="se-gear">⚙️</span>

        <Button
          type="primary"
          size="large"
          onClick={() => navigate("/")}
          style={{
            background: "#dc2626",
            borderColor: "#dc2626",
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
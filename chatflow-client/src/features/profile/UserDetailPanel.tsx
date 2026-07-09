import { useState, useEffect } from "react";
import {
  Avatar,
  Collapse,
  Typography,
  Button,
  Modal,
  message as antdMessage,
} from "antd";
import { CloseOutlined, UserOutlined, StopOutlined } from "@ant-design/icons";
import type { IUser } from "../../models/IUser";
import agent from "../../api/requests";
import { avatarUrl } from "../../utils/avatarUrl";
import "./UserDetailPanel.css";
import { formatLastSeen } from "../../utils/lastSeen";

const { Text } = Typography;

interface UserDetailPanelProps {
  user: IUser;
  isOnline: boolean;
  onClose: () => void;
}

export default function UserDetailPanel({
  user,
  isOnline,
  onClose,
}: UserDetailPanelProps) {
  const [iBlocked, setIBlocked] = useState(false);
  const [loadingBlock, setLoadingBlock] = useState(false);

  // Engel durumunu çek
  useEffect(() => {
    agent.Block.getStatus(user.id)
      .then((res: { iBlocked: boolean }) => setIBlocked(res.iBlocked))
      .catch(() => {});
  }, [user.id]);

  const handleToggleBlock = async () => {
    setLoadingBlock(true);
    try {
      if (iBlocked) {
        await agent.Block.unblock(user.id);
        setIBlocked(false);
        antdMessage.success("Engel kaldırıldı");
      } else {
        await agent.Block.block(user.id);
        setIBlocked(true);
        antdMessage.success("Kullanıcı engellendi");
      }
      // Header + mesaj kutusu güncellensin
      window.dispatchEvent(
        new CustomEvent("blockStatusChanged", { detail: { userId: user.id } }),
      );
    } catch {
      antdMessage.error("İşlem başarısız");
    } finally {
      setLoadingBlock(false);
    }
  };

  const confirmBlock = () => {
    if (iBlocked) {
      handleToggleBlock(); // engel kaldırmada onay yok
    } else {
      Modal.confirm({
        title: "Kullanıcıyı engelle",
        content: `${user.fullName} engellenecek. Karşılıklı mesajlaşma kapanacak.`,
        okText: "Engelle",
        okType: "danger",
        cancelText: "İptal",
        onOk: handleToggleBlock,
      });
    }
  };

  return (
    <div className="user-detail-panel">
      {/* Header */}
      <div className="user-detail-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Text className="user-detail-title">Profil</Text>
        </div>
        <CloseOutlined
          onClick={onClose}
          style={{ fontSize: 20, color: "#aaa", cursor: "pointer" }}
        />
      </div>

      {/* Avatar + isim + durum */}
      <div className="user-detail-avatar-section">
        <Avatar
          size={96}
          src={avatarUrl(user.avatar)}
          style={{
            background: "var(--color-primary)",
            fontSize: 34,
            fontWeight: 600,
          }}
        >
          {user.fullName?.charAt(0).toUpperCase() ?? "U"}
        </Avatar>
        <Text className="user-detail-name">{user.fullName}</Text>
        <div className="user-detail-status">
          <div
            className="user-detail-status-dot"
            style={{
              background: isOnline && !iBlocked ? "#52c41a" : "#c0c0c0",
            }}
          />
          <Text
            style={{
              fontSize: 13,
              color: isOnline && !iBlocked ? "var(--color-primary)" : "#aaa",
            }}
          >
            {iBlocked
              ? "Offline"
              : isOnline
                ? "çevrimiçi"
                : formatLastSeen(user.lastSeen)}
          </Text>
        </div>
      </div>

      {/* Bio */}
      <div className="user-detail-bio">
        {user.bio ?? "Henüz bir açıklama eklenmemiş."}
      </div>

      {/* About collapse */}
      <Collapse
        defaultActiveKey={["about"]}
        ghost
        className="user-detail-collapse"
        items={[
          {
            key: "about",
            label: (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <UserOutlined style={{ color: "var(--color-primary)" }} />
                <Text strong>About</Text>
              </div>
            ),
            children: (
              <div className="user-detail-about-box">
                {[
                  { label: "Name", value: user.fullName ?? "-" },
                  { label: "Username", value: user.userName ?? "-" },
                  { label: "Email", value: user.email ?? "-" },
                ].map((item) => (
                  <div key={item.label} className="user-detail-about-item">
                    <Text className="user-detail-about-label">
                      {item.label}
                    </Text>
                    <Text className="user-detail-about-value">
                      {item.value}
                    </Text>
                  </div>
                ))}
              </div>
            ),
          },
        ]}
      />

      {/* Engelle / Engeli kaldır */}
      <div style={{ padding: "8px 16px 20px" }}>
        <Button
          danger={!iBlocked}
          block
          icon={<StopOutlined />}
          loading={loadingBlock}
          onClick={confirmBlock}
        >
          {iBlocked ? "Engeli Kaldır" : "Engelle"}
        </Button>
      </div>
    </div>
  );
}

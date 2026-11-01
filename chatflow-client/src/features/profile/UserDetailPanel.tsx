import { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  Collapse,
  Modal,
  Skeleton,
  Typography,
  message as antdMessage,
} from "antd";
import { CloseOutlined, StopOutlined, UserOutlined } from "@ant-design/icons";
import type { IUser } from "../../models/IUser";
import agent from "../../api/requests";
import { avatarUrl } from "../../utils/avatarUrl";
import { formatLastSeen } from "../../utils/lastSeen";
import { getApiError } from "../../utils/apiError";
import "./UserDetailPanel.css";

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
  const [statusLoading, setStatusLoading] = useState(true);
  const [loadingBlock, setLoadingBlock] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatusLoading(true);

    agent.Block.getStatus(user.id)
      .then((res: { iBlocked: boolean }) => {
        if (!cancelled) setIBlocked(res.iBlocked);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });

    return () => {
      cancelled = true;
    };
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
      window.dispatchEvent(
        new CustomEvent("blockStatusChanged", { detail: { userId: user.id } }),
      );
    } catch (error) {
      antdMessage.error(getApiError(error, "İşlem başarısız"));
    } finally {
      setLoadingBlock(false);
    }
  };

  const confirmBlock = () => {
    if (iBlocked) {
      handleToggleBlock();
      return;
    }

    Modal.confirm({
      title: "Kullanıcıyı engelle",
      content: `${user.fullName} engellenecek. Karşılıklı mesajlaşma kapanacak ve arkadaş listenizden çıkarılacak.`,
      okText: "Engelle",
      okType: "danger",
      cancelText: "İptal",
      onOk: handleToggleBlock,
    });
  };

  const showOnline = isOnline && !iBlocked;
  const statusText = iBlocked
    ? "Engellendi"
    : isOnline
      ? "çevrimiçi"
      : formatLastSeen(user.lastSeen);

  return (
    <div className="user-detail-panel">
      <div className="user-detail-header">
        <Text className="user-detail-title">Profil</Text>
        <button
          type="button"
          className="user-detail-close"
          onClick={onClose}
          aria-label="Kapat"
        >
          <CloseOutlined />
        </button>
      </div>

      <div className="user-detail-avatar-section">
        <Avatar
          size={96}
          src={avatarUrl(user.avatar)}
          className="user-detail-avatar"
        >
          {user.fullName?.charAt(0).toUpperCase() ?? "U"}
        </Avatar>
        <Text className="user-detail-name">{user.fullName}</Text>
        <Text className="user-detail-username">@{user.userName}</Text>
        {statusLoading ? (
          <Skeleton.Input active size="small" className="user-detail-status-skeleton" />
        ) : (
          <div className="user-detail-status">
            <span
              className={`user-detail-status-dot ${showOnline ? "is-online" : ""}`}
            />
            <Text
              className={`user-detail-status-text ${showOnline ? "is-online" : ""}`}
            >
              {statusText}
            </Text>
          </div>
        )}
      </div>

      <div className="user-detail-bio">
        {user.bio || "Henüz bir açıklama eklenmemiş."}
      </div>

      <Collapse
        defaultActiveKey={["about"]}
        ghost
        className="user-detail-collapse"
        items={[
          {
            key: "about",
            label: (
              <div className="user-detail-collapse-label">
                <UserOutlined className="user-detail-collapse-icon" />
                <Text strong>Hakkında</Text>
              </div>
            ),
            children: (
              <div className="user-detail-about-box">
                {[
                  { label: "Ad soyad", value: user.fullName || "-" },
                  { label: "Kullanıcı adı", value: `@${user.userName}` },
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

      <div className="user-detail-actions">
        <Button
          danger={!iBlocked}
          block
          icon={<StopOutlined />}
          loading={loadingBlock}
          disabled={statusLoading}
          onClick={confirmBlock}
        >
          {iBlocked ? "Engeli Kaldır" : "Engelle"}
        </Button>
      </div>
    </div>
  );
}
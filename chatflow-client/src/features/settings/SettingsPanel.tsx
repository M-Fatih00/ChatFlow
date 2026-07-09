import {
  Avatar,
  Collapse,
  Typography,
  message,
  Modal,
  Input,
  Button,
} from "antd";
import {
  EditOutlined,
  SafetyOutlined,
  SearchOutlined,
  StopOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAppSelector, useAppDispatch } from "../../store/store";
import { updateAvatar, updateProfile } from "../../features/auth/authSlice";
import agent from "../../api/requests";
import { useRef, useState, useEffect } from "react";
import { avatarUrl } from "../../utils/avatarUrl";
import "./SettingsPanel.css";

const { Text } = Typography;
const { TextArea } = Input;

interface BlockedUser {
  id: string;
  fullName: string;
  userName: string;
  avatar?: string;
}

export default function SettingsPanel() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profil düzenleme modalı
  const [editOpen, setEditOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  // Şifre değiştirme
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Engellenen kullanıcılar (modal)
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blockedSearch, setBlockedSearch] = useState("");

  const loadBlocked = () => {
    agent.Block.getBlockedUsers()
      .then(setBlockedUsers)
      .catch(() => {});
  };

  useEffect(() => {
    loadBlocked();
    window.addEventListener("blockStatusChanged", loadBlocked);
    return () => window.removeEventListener("blockStatusChanged", loadBlocked);
  }, []);

  const handleUnblock = async (userId: string) => {
    try {
      await agent.Block.unblock(userId);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
      message.success("Engel kaldırıldı");
      window.dispatchEvent(
        new CustomEvent("blockStatusChanged", { detail: { userId } }),
      );
    } catch {
      message.error("İşlem başarısız");
    }
  };

  const filteredBlocked = blockedUsers.filter(
    (u) =>
      u.fullName.toLowerCase().includes(blockedSearch.toLowerCase()) ||
      u.userName.toLowerCase().includes(blockedSearch.toLowerCase()),
  );

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await agent.User.updateAvatar(formData);
      dispatch(updateAvatar(res.avatar));
      message.success("Profil fotoğrafı güncellendi");
    } catch {
      message.error("Fotoğraf yüklenemedi");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openEditModal = () => {
    setFullName(user?.fullName ?? "");
    setBio(user?.bio ?? "");
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      message.warning("İsim boş olamaz");
      return;
    }

    setSaving(true);
    try {
      const res = await agent.User.updateProfile({
        fullName: fullName.trim(),
        userName: user?.userName ?? "",
        avatar: user?.avatar,
        bio: bio.trim(),
      });
      dispatch(
        updateProfile({
          fullName: res.fullName,
          userName: res.userName,
          bio: res.bio,
        }),
      );
      message.success("Profil güncellendi");
      setEditOpen(false);
    } catch {
      message.error("Profil güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      message.warning("Tüm alanları doldurun");
      return;
    }
    if (newPassword.length < 6) {
      message.warning("Yeni şifre en az 6 karakter olmalı");
      return;
    }
    if (newPassword !== confirmPassword) {
      message.warning("Yeni şifreler eşleşmiyor");
      return;
    }

    setChangingPassword(true);
    try {
      await agent.Auth.changePassword({ currentPassword, newPassword });
      message.success("Şifre başarıyla değiştirildi");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      message.error("Mevcut şifre hatalı veya yeni şifre geçersiz");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="settings-panel">
      {/* Header */}
      <div className="settings-panel-header">
        <Text className="settings-panel-title">Settings</Text>
      </div>

      {/* Avatar */}
      <div className="settings-panel-avatar-section">
        <div className="settings-panel-avatar-wrapper">
          <Avatar
            size={80}
            src={avatarUrl(user?.avatar)}
            style={{
              background: "var(--color-primary)",
              fontSize: 28,
              fontWeight: 600,
            }}
          >
            {user?.fullName?.charAt(0).toUpperCase() ?? "U"}
          </Avatar>
          <div
            className="settings-panel-edit-btn"
            onClick={handleAvatarClick}
            style={{ cursor: "pointer" }}
          >
            <EditOutlined style={{ fontSize: 12, color: "#fff" }} />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={handleAvatarChange}
          />
        </div>
        <Text className="settings-panel-name">{user?.fullName ?? "-"}</Text>
      </div>

      <div className="settings-panel-divider" />

      {/* Collapse */}
      <Collapse
        accordion
        ghost={false}
        defaultActiveKey={["personal"]}
        className="settings-panel-collapse"
        items={[
          {
            key: "personal",
            label: (
              <Text strong>
                <UserOutlined
                  style={{ color: "var(--color-primary)", marginRight: 8 }}
                />
                Personal Info
              </Text>
            ),
            children: (
              <div className="settings-collapse-box">
                <div className="settings-info-row">
                  <div>
                    <Text className="settings-info-label">Name</Text>
                    <Text className="settings-info-value">
                      {user?.fullName ?? "-"}
                    </Text>
                  </div>
                  <button className="settings-edit-btn" onClick={openEditModal}>
                    <EditOutlined style={{ fontSize: 12 }} /> Edit
                  </button>
                </div>
                <div className="settings-info-row">
                  <div>
                    <Text className="settings-info-label">Bio</Text>
                    <Text className="settings-info-value">
                      {user?.bio ?? "-"}
                    </Text>
                  </div>
                </div>
                <div
                  className="settings-info-row"
                  style={{ borderBottom: "none" }}
                >
                  <div>
                    <Text className="settings-info-label">Email</Text>
                    <Text className="settings-info-value">
                      {user?.email ?? "-"}
                    </Text>
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "security",
            label: (
              <Text strong>
                <SafetyOutlined
                  style={{ color: "var(--color-primary)", marginRight: 8 }}
                />
                Security
              </Text>
            ),
            children: (
              <div className="settings-collapse-box">
                <div style={{ padding: "4px 0" }}>
                  <Text
                    strong
                    style={{ display: "block", marginBottom: 12, fontSize: 14 }}
                  >
                    Şifre Değiştir
                  </Text>

                  <div style={{ marginBottom: 12 }}>
                    <Text
                      className="settings-info-label"
                      style={{ display: "block", marginBottom: 4 }}
                    >
                      Mevcut Şifre
                    </Text>
                    <Input.Password
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Mevcut şifreniz"
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <Text
                      className="settings-info-label"
                      style={{ display: "block", marginBottom: 4 }}
                    >
                      Yeni Şifre
                    </Text>
                    <Input.Password
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Yeni şifre (en az 6 karakter)"
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <Text
                      className="settings-info-label"
                      style={{ display: "block", marginBottom: 4 }}
                    >
                      Yeni Şifre (Tekrar)
                    </Text>
                    <Input.Password
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Yeni şifreyi tekrar girin"
                    />
                  </div>

                  <Button
                    type="primary"
                    block
                    loading={changingPassword}
                    onClick={handleChangePassword}
                    style={{
                      background: "var(--color-primary)",
                      borderColor: "var(--color-primary)",
                    }}
                  >
                    Şifreyi Değiştir
                  </Button>
                </div>
              </div>
            ),
          },
          {
            key: "blocked",
            label: (
              <Text strong>
                <StopOutlined style={{ color: "#ff4d4f", marginRight: 8 }} />
                Blocked Users
              </Text>
            ),
            children: (
              <div className="settings-collapse-box">
                <div
                  className="settings-info-row"
                  style={{ borderBottom: "none" }}
                >
                  <Text className="settings-info-value">
                    {blockedUsers.length} blocked{" "}
                    {blockedUsers.length === 1 ? "user" : "users"}
                  </Text>
                  <Button
                    size="small"
                    onClick={() => {
                      setBlockedSearch("");
                      setBlockedOpen(true);
                    }}
                  >
                    Manage
                  </Button>
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Engellenenler modalı */}
      <Modal
        title="Blocked Users"
        open={blockedOpen}
        onCancel={() => setBlockedOpen(false)}
        footer={null}
      >
        <Input
          prefix={<SearchOutlined style={{ color: "#b0aec8" }} />}
          placeholder="Search by name or username"
          value={blockedSearch}
          onChange={(e) => setBlockedSearch(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {filteredBlocked.length === 0 ? (
            <Text style={{ color: "#aaa", fontSize: 13 }}>
              {blockedUsers.length === 0
                ? "No blocked users."
                : "No results found."}
            </Text>
          ) : (
            filteredBlocked.map((u) => (
              <div
                key={u.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <Avatar
                  size={40}
                  src={avatarUrl(u.avatar)}
                  style={{
                    background: "var(--color-primary)",
                    fontSize: 15,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {u.fullName.charAt(0).toUpperCase()}
                </Avatar>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ display: "block" }}>
                    {u.fullName}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#aaa" }}>
                    @{u.userName}
                  </Text>
                </div>
                <Button
                  size="small"
                  danger
                  icon={<StopOutlined />}
                  onClick={() => handleUnblock(u.id)}
                >
                  Unblock
                </Button>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Profil düzenleme modalı */}
      <Modal
        title="Profili Düzenle"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setEditOpen(false)}>
            İptal
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={saving}
            onClick={handleSave}
            style={{
              background: "var(--color-primary)",
              borderColor: "var(--color-primary)",
            }}
          >
            Kaydet
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>İsim</Text>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="İsminiz"
            style={{ marginTop: 6 }}
          />
        </div>
        <div>
          <Text strong>Hakkında</Text>
          <TextArea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Kendinizden kısaca bahsedin"
            maxLength={140}
            showCount
            autoSize={{ minRows: 2, maxRows: 4 }}
            style={{ marginTop: 6 }}
          />
        </div>
      </Modal>
    </div>
  );
}

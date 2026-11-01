import {
  Avatar,
  Button,
  Collapse,
  Input,
  Modal,
  Skeleton,
  Spin,
  Typography,
  message,
} from "antd";
import {
  EditOutlined,
  LogoutOutlined,
  SafetyOutlined,
  SearchOutlined,
  StopOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useAppDispatch, useAppSelector } from "../../store/store";
import {
  logoutUser,
  updateAvatar,
  updateProfile,
} from "../../features/auth/authSlice";
import agent from "../../api/requests";
import { avatarUrl } from "../../utils/avatarUrl";
import { getApiError } from "../../utils/apiError";
import "./SettingsPanel.css";

const { Text } = Typography;
const { TextArea } = Input;

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,30}$/;

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

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blockedSearch, setBlockedSearch] = useState("");

  const emailChanged =
    email.trim().length > 0 &&
    email.trim().toLowerCase() !== (user?.email ?? "").toLowerCase();

  const loadBlocked = useCallback(() => {
    agent.Block.getBlockedUsers()
      .then(setBlockedUsers)
      .catch(() => undefined)
      .finally(() => setBlockedLoading(false));
  }, []);

  useEffect(() => {
    loadBlocked();
    window.addEventListener("blockStatusChanged", loadBlocked);
    return () => window.removeEventListener("blockStatusChanged", loadBlocked);
  }, [loadBlocked]);

  const handleUnblock = async (userId: string) => {
    try {
      await agent.Block.unblock(userId);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
      message.success("Engel kaldırıldı");
      window.dispatchEvent(
        new CustomEvent("blockStatusChanged", { detail: { userId } }),
      );
    } catch (error) {
      message.error(getApiError(error, "İşlem başarısız"));
    }
  };

  const searchTerm = blockedSearch.trim().toLowerCase();
  const filteredBlocked = blockedUsers.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchTerm) ||
      u.userName.toLowerCase().includes(searchTerm),
  );

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    if (!AVATAR_TYPES.includes(file.type)) {
      message.warning("Sadece jpg, png ve webp dosyaları yükleyebilirsiniz");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      message.warning("Fotoğraf en fazla 2MB olabilir");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploadingAvatar(true);
    try {
      const res = await agent.User.updateAvatar(formData);
      dispatch(updateAvatar(res.avatar));
      message.success("Profil fotoğrafı güncellendi");
    } catch (error) {
      message.error(getApiError(error, "Fotoğraf yüklenemedi"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const openEditModal = () => {
    setFullName(user?.fullName ?? "");
    setUserName(user?.userName ?? "");
    setEmail(user?.email ?? "");
    setBio(user?.bio ?? "");
    setEmailPassword("");
    setEditOpen(true);
  };

  const handleSave = async () => {
    const trimmedName = fullName.trim();
    const trimmedUserName = userName.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      message.warning("İsim en az 2 karakter olmalı");
      return;
    }
    if (!USERNAME_PATTERN.test(trimmedUserName)) {
      message.warning(
        "Kullanıcı adı 3-30 karakter olmalı; harf, rakam, nokta, alt çizgi ve tire içerebilir",
      );
      return;
    }
    if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
      message.warning("Geçerli bir e-posta adresi girin");
      return;
    }
    if (emailChanged && !emailPassword) {
      message.warning("E-posta değiştirmek için mevcut şifrenizi girin");
      return;
    }

    setSaving(true);
    try {
      const res = await agent.User.updateProfile({
        fullName: trimmedName,
        userName: trimmedUserName,
        email: trimmedEmail || undefined,
        bio: bio.trim() || undefined,
        currentPassword: emailChanged ? emailPassword : undefined,
      });
      dispatch(
        updateProfile({
          fullName: res.fullName,
          userName: res.userName,
          email: res.email,
          bio: res.bio,
        }),
      );
      message.success("Profil güncellendi");
      setEditOpen(false);
    } catch (error) {
      message.error(getApiError(error, "Profil güncellenemedi"));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      message.warning("Tüm alanları doldurun");
      return;
    }
    if (newPassword.length < 8) {
      message.warning("Yeni şifre en az 8 karakter olmalı");
      return;
    }
    if (!/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      message.warning("Yeni şifre küçük harf ve rakam içermeli");
      return;
    }
    if (newPassword !== confirmPassword) {
      message.warning("Yeni şifreler eşleşmiyor");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await agent.Auth.changePassword({
        currentPassword,
        newPassword,
      });
      message.success(res?.message ?? "Şifre değiştirildi");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      message.error(
        getApiError(error, "Mevcut şifre hatalı veya yeni şifre geçersiz"),
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const confirmLogout = () => {
    Modal.confirm({
      title: "Çıkış Yap",
      content: "Çıkış yapmak istediğinize emin misiniz?",
      okText: "Çıkış Yap",
      okType: "danger",
      cancelText: "İptal",
      onOk: () => dispatch(logoutUser()),
    });
  };

  const confirmLogoutAll = () => {
    Modal.confirm({
      title: "Tüm cihazlardan çıkış",
      content:
        "Bu cihaz dahil, hesabınızın açık olduğu tüm cihazlarda oturum kapanacak.",
      okText: "Tümünden Çık",
      okType: "danger",
      cancelText: "İptal",
      onOk: async () => {
        try {
          await agent.Auth.logoutAll();
        } finally {
          dispatch(logoutUser());
        }
      },
    });
  };

  return (
    <div className="settings-panel">
      <div className="settings-panel-header">
        <Text className="settings-panel-title">Ayarlar</Text>
      </div>

      <div className="settings-panel-avatar-section anim anim-fade-up">
        <div className="settings-panel-avatar-wrapper">
          <Spin spinning={uploadingAvatar}>
            <Avatar
              size={80}
              src={avatarUrl(user?.avatar)}
              className="settings-panel-avatar"
            >
              {user?.fullName?.charAt(0).toUpperCase() ?? "U"}
            </Avatar>
          </Spin>
          <button
            type="button"
            className="settings-panel-edit-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Profil fotoğrafını değiştir"
          >
            <EditOutlined />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={AVATAR_TYPES.join(",")}
            hidden
            onChange={handleAvatarChange}
          />
        </div>
        <Text className="settings-panel-name">{user?.fullName ?? "-"}</Text>
        <Text className="settings-panel-username">@{user?.userName}</Text>
      </div>

      <div className="settings-panel-divider" />

      <Collapse
        accordion
        defaultActiveKey={["personal"]}
        className="settings-panel-collapse anim anim-fade-up"
        style={{ animationDelay: "80ms" }}
        items={[
          {
            key: "personal",
            label: (
              <Text strong>
                <UserOutlined className="settings-section-icon" />
                Kişisel Bilgiler
              </Text>
            ),
            children: (
              <div className="settings-collapse-box">
                <div className="settings-info-row">
                  <div>
                    <Text className="settings-info-label">Ad soyad</Text>
                    <Text className="settings-info-value">
                      {user?.fullName || "-"}
                    </Text>
                  </div>
                  <button
                    type="button"
                    className="settings-edit-btn"
                    onClick={openEditModal}
                  >
                    <EditOutlined /> Düzenle
                  </button>
                </div>
                <div className="settings-info-row">
                  <div>
                    <Text className="settings-info-label">Kullanıcı adı</Text>
                    <Text className="settings-info-value">
                      @{user?.userName || "-"}
                    </Text>
                  </div>
                </div>
                <div className="settings-info-row">
                  <div>
                    <Text className="settings-info-label">Hakkında</Text>
                    <Text className="settings-info-value">
                      {user?.bio || "-"}
                    </Text>
                  </div>
                </div>
                <div className="settings-info-row settings-info-row-last">
                  <div>
                    <Text className="settings-info-label">E-posta</Text>
                    <Text className="settings-info-value">
                      {user?.email || "-"}
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
                <SafetyOutlined className="settings-section-icon" />
                Güvenlik
              </Text>
            ),
            children: (
              <div className="settings-collapse-box settings-security">
                <Text strong className="settings-subtitle">
                  Şifre Değiştir
                </Text>

                <label className="settings-field">
                  <Text className="settings-info-label">Mevcut şifre</Text>
                  <Input.Password
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Mevcut şifreniz"
                    autoComplete="current-password"
                    maxLength={128}
                  />
                </label>

                <label className="settings-field">
                  <Text className="settings-info-label">Yeni şifre</Text>
                  <Input.Password
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="En az 8 karakter, harf ve rakam"
                    autoComplete="new-password"
                    maxLength={128}
                  />
                </label>

                <label className="settings-field">
                  <Text className="settings-info-label">Yeni şifre (tekrar)</Text>
                  <Input.Password
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Yeni şifreyi tekrar girin"
                    autoComplete="new-password"
                    maxLength={128}
                  />
                </label>

                <Button
                  type="primary"
                  block
                  loading={changingPassword}
                  onClick={handleChangePassword}
                  className="settings-primary-btn"
                >
                  Şifreyi Değiştir
                </Button>

                <div className="settings-security-divider" />

                <Text strong className="settings-subtitle">
                  Oturumlar
                </Text>
                <Text type="secondary" className="settings-help">
                  Hesabınız başka bir cihazda açık kaldıysa tüm oturumları
                  kapatabilirsiniz.
                </Text>
                <Button danger block onClick={confirmLogoutAll}>
                  Tüm cihazlardan çıkış yap
                </Button>
              </div>
            ),
          },
          {
            key: "blocked",
            label: (
              <Text strong>
                <StopOutlined className="settings-section-icon settings-section-icon-danger" />
                Engellenen Kullanıcılar
              </Text>
            ),
            children: (
              <div className="settings-collapse-box">
                <div className="settings-info-row settings-info-row-last">
                  {blockedLoading ? (
                    <Skeleton.Input active size="small" />
                  ) : (
                    <Text className="settings-info-value">
                      {blockedUsers.length} engellenen kullanıcı
                    </Text>
                  )}
                  <Button
                    size="small"
                    onClick={() => {
                      setBlockedSearch("");
                      setBlockedOpen(true);
                    }}
                  >
                    Yönet
                  </Button>
                </div>
              </div>
            ),
          },
        ]}
      />

      <Modal
        title="Engellenen Kullanıcılar"
        open={blockedOpen}
        onCancel={() => setBlockedOpen(false)}
        footer={null}
      >
        <Input
          prefix={<SearchOutlined className="settings-search-icon" />}
          placeholder="İsim veya kullanıcı adıyla ara"
          value={blockedSearch}
          onChange={(e) => setBlockedSearch(e.target.value)}
          allowClear
          className="settings-blocked-search"
        />
        <div className="settings-blocked-list">
          {filteredBlocked.length === 0 ? (
            <Text type="secondary">
              {blockedUsers.length === 0
                ? "Engellediğiniz kullanıcı yok."
                : "Sonuç bulunamadı."}
            </Text>
          ) : (
            filteredBlocked.map((u) => (
              <div key={u.id} className="settings-blocked-item">
                <Avatar
                  size={40}
                  src={avatarUrl(u.avatar)}
                  className="settings-blocked-avatar"
                >
                  {u.fullName.charAt(0).toUpperCase()}
                </Avatar>
                <div className="settings-blocked-info">
                  <Text strong ellipsis>
                    {u.fullName}
                  </Text>
                  <Text type="secondary" className="settings-blocked-username">
                    @{u.userName}
                  </Text>
                </div>
                <Button size="small" onClick={() => handleUnblock(u.id)}>
                  Engeli kaldır
                </Button>
              </div>
            ))
          )}
        </div>
      </Modal>

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
            className="settings-primary-btn"
          >
            Kaydet
          </Button>,
        ]}
      >
        <label className="settings-modal-field">
          <Text strong>Ad soyad</Text>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Adınız Soyadınız"
            autoComplete="name"
            maxLength={60}
          />
        </label>
        <label className="settings-modal-field">
          <Text strong>Kullanıcı adı</Text>
          <Input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="kullaniciadi"
            autoComplete="username"
            maxLength={30}
          />
        </label>
        <label className="settings-modal-field">
          <Text strong>E-posta</Text>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@mail.com"
            autoComplete="email"
            maxLength={254}
          />
        </label>
        {emailChanged && (
          <label className="settings-modal-field">
            <Text strong>Mevcut şifre</Text>
            <Text type="secondary" className="settings-help">
              E-posta adresinizi değiştirmek için şifrenizi doğrulayın.
            </Text>
            <Input.Password
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder="Mevcut şifreniz"
              autoComplete="current-password"
              maxLength={128}
            />
          </label>
        )}
        <label className="settings-modal-field">
          <Text strong>Hakkında</Text>
          <TextArea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Kendinizden kısaca bahsedin"
            maxLength={140}
            showCount
            autoSize={{ minRows: 2, maxRows: 4 }}
          />
        </label>
      </Modal>

      <div className="settings-logout-section">
        <Button
          danger
          block
          icon={<LogoutOutlined />}
          onClick={confirmLogout}
          className="settings-logout-btn"
        >
          Çıkış Yap
        </Button>
      </div>
    </div>
  );
}
import { useRef, useState } from "react";
import {
  Avatar,
  Typography,
  Modal,
  Input,
  Dropdown,
  Button,
  message as antdMessage,
} from "antd";
import {
  CloseOutlined,
  TeamOutlined,
  EditOutlined,
  CameraOutlined,
  CrownOutlined,
  DeleteOutlined,
  UserAddOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import type { IUser } from "../../models/IUser";
import type { IRoom } from "../../models/IRoom";
import type { IRoomMember } from "../../models/IRoomMember";
import agent from "../../api/requests";
import { avatarUrl } from "../../utils/avatarUrl";
import "./GroupDetailPanel.css";

const { Text } = Typography;
const { TextArea } = Input;

interface GroupDetailPanelProps {
  room: IRoom;
  members: IRoomMember[];
  currentUser: IUser | null;
  isCurrentUserAdmin: boolean;
  onClose: () => void;
  onRoomUpdated: (room: IRoom) => void;
  onOpenAddMember: () => void;
  onMakeAdmin: (memberId: string) => void;
  onRemoveMember: (memberId: string) => void;
}

export default function GroupDetailPanel({
  room,
  members,
  currentUser,
  isCurrentUserAdmin,
  onClose,
  onRoomUpdated,
  onOpenAddMember,
  onMakeAdmin,
  onRemoveMember,
}: GroupDetailPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // İsim + açıklama düzenleme modalı
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(room.name);
  const [editDescription, setEditDescription] = useState(room.description ?? "");
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    setEditName(room.name);
    setEditDescription(room.description ?? "");
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      antdMessage.warning("Grup adı boş olamaz");
      return;
    }
    setSaving(true);
    try {
      const updated = await agent.Room.updateRoom(room.id, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      onRoomUpdated(updated);
      antdMessage.success("Grup güncellendi");
      setEditOpen(false);
    } catch {
      antdMessage.error("Güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await agent.Room.updateRoomAvatar(room.id, formData);
      onRoomUpdated({ ...room, avatar: res.avatar });
      antdMessage.success("Grup fotoğrafı güncellendi");
    } catch {
      antdMessage.error("Fotoğraf yüklenemedi");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="group-detail-panel">
      {/* Header */}
      <div className="group-detail-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Text className="group-detail-title">Grup Bilgisi</Text>
        </div>
        <CloseOutlined
          onClick={onClose}
          style={{ fontSize: 16, color: "#aaa", cursor: "pointer" }}
        />
      </div>

      {/* Avatar + isim */}
      <div className="group-detail-avatar-section">
        <div className="group-detail-avatar-wrapper">
          <Avatar
            size={96}
            src={avatarUrl(room.avatar)}
            style={{
              background: "var(--color-primary-light)",
              color: "var(--color-primary)",
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            {room.name?.charAt(0).toUpperCase()}
          </Avatar>
          {isCurrentUserAdmin && (
            <div
              className="group-detail-avatar-edit"
              onClick={() => fileInputRef.current?.click()}
            >
              <CameraOutlined style={{ fontSize: 14, color: "#fff" }} />
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleAvatarChange}
          />
        </div>

        <div className="group-detail-name-row">
          <Text className="group-detail-name">{room.name}</Text>
          {isCurrentUserAdmin && (
            <EditOutlined
              onClick={openEdit}
              style={{ color: "#aaa", cursor: "pointer", fontSize: 15 }}
            />
          )}
        </div>
        <div className="group-detail-member-count">
          <TeamOutlined /> {members.length} üye
        </div>
      </div>

      {/* Açıklama */}
      <div className="group-detail-desc">
        <Text className="group-detail-desc-label">Açıklama</Text>
        <Text className="group-detail-desc-value">
          {room.description?.trim()
            ? room.description
            : "Henüz açıklama eklenmemiş."}
        </Text>
      </div>

      {/* Üyeler */}
      <div className="group-detail-members">
        <div className="group-detail-members-head">
          <Text className="group-detail-desc-label">Üyeler</Text>
          {isCurrentUserAdmin && (
            <Button
              size="small"
              icon={<UserAddOutlined />}
              onClick={onOpenAddMember}
            >
              Ekle
            </Button>
          )}
        </div>

        {members.map((m) => (
          <div key={m.userId} className="group-detail-member-item">
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <Avatar
                size={36}
                src={avatarUrl(m.avatar)}
                style={{
                  background: "var(--color-primary)",
                  fontSize: 13,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {m.fullName.charAt(0).toUpperCase()}
              </Avatar>
              <div style={{ minWidth: 0 }}>
                <Text className="group-detail-member-name">
                  {m.fullName}
                  {m.userId === currentUser?.id && " (Sen)"}
                </Text>
                {m.isAdmin && (
                  <Text className="group-detail-member-admin">
                    <CrownOutlined /> Yönetici
                  </Text>
                )}
              </div>
            </div>

            {isCurrentUserAdmin && m.userId !== currentUser?.id && (
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    ...(m.isAdmin
                      ? []
                      : [
                          {
                            key: "make-admin",
                            label: "Yönetici yap",
                            icon: <CrownOutlined />,
                            onClick: () => onMakeAdmin(m.userId),
                          },
                        ]),
                    {
                      key: "remove",
                      label: "Gruptan çıkar",
                      icon: <DeleteOutlined />,
                      danger: true,
                      onClick: () => onRemoveMember(m.userId),
                    },
                  ],
                }}
              >
                <MoreOutlined style={{ cursor: "pointer", fontSize: 16, color: "#aaa" }} />
              </Dropdown>
            )}
          </div>
        ))}
      </div>

      {/* Düzenleme modalı */}
      <Modal
        title="Grubu Düzenle"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleSaveEdit}
        okText="Kaydet"
        cancelText="İptal"
        confirmLoading={saving}
        okButtonProps={{
          style: {
            background: "var(--color-primary)",
            borderColor: "var(--color-primary)",
          },
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>Grup Adı</Text>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            style={{ marginTop: 6 }}
            maxLength={50}
          />
        </div>
        <div>
          <Text strong>Açıklama</Text>
          <TextArea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            style={{ marginTop: 6 }}
            rows={3}
            maxLength={200}
            showCount
          />
        </div>
      </Modal>
    </div>
  );
}
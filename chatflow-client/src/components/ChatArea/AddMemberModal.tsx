import { Avatar, Typography, Modal, Checkbox } from "antd";
import type { IUser } from "../../models/IUser";
import { avatarUrl } from "../../utils/avatarUrl";

const { Text } = Typography;

interface AddMemberModalProps {
  open: boolean;
  onClose: () => void;
  onOk: () => void;
  allUsers: IUser[];
  selectedNewMembers: string[];
  toggleNewMember: (userId: string) => void;
}

export default function AddMemberModal({
  open,
  onClose,
  onOk,
  allUsers,
  selectedNewMembers,
  toggleNewMember,
}: AddMemberModalProps) {
  return (
    <Modal
      title="Üye Ekle"
      open={open}
      onCancel={onClose}
      onOk={onOk}
      okText="Ekle"
      cancelText="İptal"
      okButtonProps={{
        style: {
          background: "var(--color-primary)",
          borderColor: "var(--color-primary)",
        },
        disabled: selectedNewMembers.length === 0,
      }}
    >
      <div
        style={{
          maxHeight: 280,
          overflowY: "auto",
          border: "1px solid #f0f0f0",
          borderRadius: 8,
          padding: 8,
        }}
      >
        {allUsers.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 13 }}>
            Eklenebilecek kullanıcı yok
          </Text>
        ) : (
          allUsers.map((u) => (
            <div
              key={u.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 4px",
                cursor: "pointer",
              }}
              onClick={() => toggleNewMember(u.id)}
            >
              <Checkbox
                checked={selectedNewMembers.includes(u.id)}
                onChange={() => toggleNewMember(u.id)}
              />
              <Avatar
                size={28}
                src={avatarUrl(u.avatar)}
                style={{
                  background: "var(--color-primary)",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {u.fullName.charAt(0).toUpperCase()}
              </Avatar>
              <Text style={{ fontSize: 13 }}>{u.fullName}</Text>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
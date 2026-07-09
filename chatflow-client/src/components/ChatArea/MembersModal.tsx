import { Avatar, Dropdown, Typography, Modal, Button } from "antd";
import {
  MoreOutlined,
  DeleteOutlined,
  CrownOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import type { IUser } from "../../models/IUser";
import type { IRoomMember } from "../../models/IRoomMember";
import { avatarUrl } from "../../utils/avatarUrl";

const { Text } = Typography;

interface MembersModalProps {
  open: boolean;
  onClose: () => void;
  members: IRoomMember[];
  currentUser: IUser | null;
  isCurrentUserAdmin: boolean;
  onOpenAddMember: () => void;
  onMakeAdmin: (memberId: string) => void;
  onRemoveMember: (memberId: string) => void;
}

export default function MembersModal({
  open,
  onClose,
  members,
  currentUser,
  isCurrentUserAdmin,
  onOpenAddMember,
  onMakeAdmin,
  onRemoveMember,
}: MembersModalProps) {
  return (
    <Modal
      title={`Grup Üyeleri (${members.length})`}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="add" icon={<UserAddOutlined />} onClick={onOpenAddMember}>
          Üye Ekle
        </Button>,
        <Button key="close" onClick={onClose}>
          Kapat
        </Button>,
      ]}
    >
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {members.map((m) => (
          <div
            key={m.userId}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 4px",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar
                size={36}
                src={avatarUrl(m.avatar)}
                style={{
                  background: "var(--color-primary)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {m.fullName.charAt(0).toUpperCase()}
              </Avatar>
              <div>
                <Text style={{ fontSize: 14, display: "block" }}>
                  {m.fullName}
                  {m.userId === currentUser?.id && " (Sen)"}
                </Text>
                {m.isAdmin && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: "var(--color-primary)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
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
                <MoreOutlined style={{ cursor: "pointer", fontSize: 16 }} />
              </Dropdown>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
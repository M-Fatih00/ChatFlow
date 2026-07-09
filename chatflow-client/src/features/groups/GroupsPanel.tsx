import {
  Avatar,
  Input,
  Typography,
  Modal,
  Checkbox,
  message,
  Empty,
  Dropdown,
} from "antd";
import {
  SearchOutlined,
  UserAddOutlined,
  MoreOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import agent from "../../api/requests";
import { useAppSelector, useAppDispatch } from "../../store/store";
import { clearActiveConversation } from "../chats/chatSlice";
import type { IRoom } from "../../models/IRoom";
import type { IUser } from "../../models/IUser";
import "./GroupsPanel.css";
import { avatarUrl } from "../../utils/avatarUrl";

const { Text } = Typography;

export default function GroupsPanel() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const { activeConversationId, isRoom, unreadCounts } = useAppSelector(
    (state) => state.chat,
  );

  const [rooms, setRooms] = useState<IRoom[]>([]);
  const [search, setSearch] = useState("");

  // Grup oluşturma modalı
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [allUsers, setAllUsers] = useState<IUser[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  const fetchRooms = () => {
    agent.Room.getRooms().then(setRooms);
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  // Gruba eklenince veya çıkarılınca listeyi yenile
  useEffect(() => {
    const handleRoomUpdate = () => {
      fetchRooms();
    };

    window.addEventListener("removedFromRoom", handleRoomUpdate);
    window.addEventListener("addedToRoom", handleRoomUpdate);
    window.addEventListener("roomUpdated", handleRoomUpdate);
    return () => {
      window.removeEventListener("removedFromRoom", handleRoomUpdate);
      window.removeEventListener("addedToRoom", handleRoomUpdate);
      window.removeEventListener("roomUpdated", handleRoomUpdate);
    };
  }, []);

  const openCreateModal = () => {
    setGroupName("");
    setSelectedMembers([]);
    agent.User.getUsers().then((users: IUser[]) => {
      setAllUsers(users.filter((u) => u.id !== currentUser?.id));
    });
    setCreateOpen(true);
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      message.warning("Grup adı boş olamaz");
      return;
    }
    if (selectedMembers.length === 0) {
      message.warning("En az bir üye seçin");
      return;
    }

    setCreating(true);
    try {
      const room = await agent.Room.createRoom({
        name: groupName.trim(),
        memberIds: selectedMembers,
      });
      message.success("Grup oluşturuldu");
      setCreateOpen(false);
      fetchRooms();
      navigate(`/room/${room.id}`);
    } catch {
      message.error("Grup oluşturulamadı");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRoom = async (room: IRoom) => {
    Modal.confirm({
      title: "Grubu Sil",
      content: `"${room.name}" grubunu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      okText: "Sil",
      okType: "danger",
      cancelText: "İptal",
      onOk: async () => {
        try {
          await agent.Room.deleteRoom(room.id);
          message.success("Grup silindi");

          if (isRoom && activeConversationId === String(room.id)) {
            dispatch(clearActiveConversation());
            navigate("/");
          }

          fetchRooms();
        } catch {
          message.error("Grup silinemedi");
        }
      },
    });
  };

  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredMembers = allUsers.filter(
    (u) =>
      u.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
      u.userName.toLowerCase().includes(memberSearch.toLowerCase()),
  );

  // Bu grupta kaç okunmamış mesaj var?
  const unreadCount = (roomId: number) => unreadCounts[String(roomId)] || 0;

  return (
    <div
      className="groups-panel">
      <div className="groups-panel-header">
        <Text className="groups-panel-header-title">Groups</Text>
        <UserAddOutlined
          className="groups-panel-header-icon"
          onClick={openCreateModal}
          style={{ cursor: "pointer" }}
        />
      </div>

      <div className="groups-panel-search">
        <Input
          prefix={<SearchOutlined style={{ color: "#b0aec8", fontSize: 15 }} />}
          placeholder="Search groups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="groups-panel-list">
        {filteredRooms.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <Empty
              description="Henüz grup yok"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : (
          filteredRooms.map((room) => {
            const active = isRoom && activeConversationId === String(room.id);
            const isCreator = room.createdBy === currentUser?.id;
            const count = unreadCount(room.id);
            const unread = count > 0;

            return (
              <div
                key={room.id}
                className={`groups-panel-item ${active ? "active" : ""}`}
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  className="groups-panel-item-left"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                  onClick={() => {
                    if (!active) {
                      navigate(`/room/${room.id}`);
                    }
                  }}
                >
                  <Avatar
                    size={40}
                    src={avatarUrl(room.avatar)}
                    style={{
                      background: "var(--color-primary-light)",
                      color: "var(--color-primary)",
                      fontSize: 16,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {room.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Text
                      style={{
                        display: "block",
                        fontSize: 15,
                        fontWeight: unread ? 800 : 500,
                        color: unread ? "#111" : "#333",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      #{room.name}
                    </Text>
                    {unread && (
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--color-primary)",
                        }}
                      >
                        {count} yeni mesaj
                      </Text>
                    )}
                  </div>
                </div>

                <div
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Okunmamış sayı rozeti */}
                  {unread && (
                    <span className="groups-unread-badge">{count}</span>
                  )}

                  {/* Sadece grubu kuran silebilir */}
                  {isCreator && (
                    <Dropdown
                      trigger={["click"]}
                      menu={{
                        items: [
                          {
                            key: "delete",
                            label: "Grubu Sil",
                            icon: <DeleteOutlined />,
                            danger: true,
                            onClick: () => handleDeleteRoom(room),
                          },
                        ],
                      }}
                    >
                      <MoreOutlined
                        style={{
                          fontSize: 18,
                          color: "#aaa",
                          cursor: "pointer",
                        }}
                      />
                    </Dropdown>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Grup oluşturma modalı */}
      <Modal
        title="Yeni Grup Oluştur"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreateGroup}
        okText="Oluştur"
        cancelText="İptal"
        confirmLoading={creating}
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
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Grup adı"
            style={{ marginTop: 6 }}
          />
        </div>

        <div>
          <Text strong>Üyeler</Text>
          <Input
            prefix={<SearchOutlined style={{ color: "#b0aec8" }} />}
            placeholder="Üye ara"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            style={{ margin: "6px 0 10px" }}
          />
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {filteredMembers.map((u) => (
              <div
                key={u.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 4px",
                  cursor: "pointer",
                }}
                onClick={() => toggleMember(u.id)}
              >
                <Checkbox checked={selectedMembers.includes(u.id)} />
                <Avatar
                  size={32}
                  src={avatarUrl(u.avatar)}
                  style={{
                    background: "var(--color-primary)",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {u.fullName.charAt(0).toUpperCase()}
                </Avatar>
                <div style={{ minWidth: 0 }}>
                  <Text style={{ display: "block" }}>{u.fullName}</Text>
                  <Text style={{ fontSize: 12, color: "#aaa" }}>
                    @{u.userName}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

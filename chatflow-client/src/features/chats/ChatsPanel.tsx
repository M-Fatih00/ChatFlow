import {
  Avatar,
  Input,
  Badge,
  Typography,
  Dropdown,
  Modal,
  message as antdMessage,
} from "antd";
import {
  SearchOutlined,
  MoreOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import "./ChatsPanel.css";
import { useEffect, useState, useRef } from "react";
import type { IUser } from "../../models/IUser";
import agent from "../../api/requests";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { useNavigate } from "react-router-dom";
import { avatarUrl } from "../../utils/avatarUrl";
import { formatLastSeen } from "../../utils/lastSeen";
import { clearActiveConversation } from "../chats/chatSlice";

const { Text } = Typography;

export default function ChatsPanel() {
  const [users, setUsers] = useState<IUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<IUser[]>([]);
  // Mobil long-press menüsü
  const [longPressUser, setLongPressUser] = useState<IUser | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { onlineUsers, activeConversationId, unreadCounts } = useAppSelector(
    (state) => state.chat,
  );
  const { user: currentUser } = useAppSelector((state) => state.auth);

  const loadConversations = () => {
    agent.Message.getConversations()
      .then(setUsers)
      .catch(() => {});
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    const handler = () => loadConversations();
    window.addEventListener("messageReceived", handler);
    return () => window.removeEventListener("messageReceived", handler);
  }, []);

  useEffect(() => {
    const load = () => {
      agent.Block.getBlocked()
        .then(setBlockedIds)
        .catch(() => {});
    };
    load();
    window.addEventListener("blockStatusChanged", load);
    return () => window.removeEventListener("blockStatusChanged", load);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { userId, avatar } = (e as CustomEvent).detail;
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, avatar } : u)),
      );
      setFriends((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, avatar } : u)),
      );
    };
    window.addEventListener("avatarUpdated", handler);
    return () => window.removeEventListener("avatarUpdated", handler);
  }, []);

  useEffect(() => {
    const loadFriends = () => {
      agent.Friendship.getFriends()
        .then(setFriends)
        .catch(() => {});
    };
    loadFriends();
    window.addEventListener("friendRequestAccepted", loadFriends);
    window.addEventListener("friendRemoved", loadFriends);
    window.addEventListener("blockStatusChanged", loadFriends);
    return () => {
      window.removeEventListener("friendRequestAccepted", loadFriends);
      window.removeEventListener("friendRemoved", loadFriends);
      window.removeEventListener("blockStatusChanged", loadFriends);
    };
  }, []);

  const otherUsers = users.filter((u) => u.userName !== currentUser?.userName);

  const filteredUsers = otherUsers.filter((u) =>
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const onlineUsersList = friends.filter(
    (u) => onlineUsers.includes(u.id) && !blockedIds.includes(u.id),
  );

  const isUserOnline = (id: string) =>
    onlineUsers.includes(id) && !blockedIds.includes(id);

  const unreadCount = (id: string) => unreadCounts[id] || 0;

  // Sohbeti sil (benim için)
  const confirmDelete = (u: IUser) => {
    Modal.confirm({
      title: "Sohbeti Sil",
      content: `"${u.fullName}" ile olan sohbeti silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      okText: "Sil",
      okType: "danger",
      cancelText: "İptal",
      onOk: async () => {
        try {
          await agent.Message.deleteConversation(u.id);
          setUsers((prev) => prev.filter((usr) => usr.id !== u.id));
          // Eğer o sohbet açıksa kapat
          if (activeConversationId === u.id) {
            dispatch(clearActiveConversation());
            navigate("/");
          }
          antdMessage.success("Sohbet silindi");
        } catch {
          antdMessage.error("Sohbet silinemedi");
        }
      },
    });
  };

  // Mobil long-press
  const startLongPress = (u: IUser) => {
    longPressTimer.current = setTimeout(() => setLongPressUser(u), 450);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <div
      className="chats-panel"
      onClick={() => {
        dispatch(clearActiveConversation());
        navigate("/");
      }}
    >
      {/* Mobil long-press menüsü açıkken overlay */}
      {longPressUser && (
        <div
          onClick={() => setLongPressUser(null)}
          style={{ position: "fixed", inset: 0, zIndex: 1000 }}
        />
      )}

      <div className="chats-panel-header">Chats</div>

      <div className="chats-panel-search" onClick={(e) => e.stopPropagation()}>
        <Input
          prefix={<SearchOutlined style={{ color: "#b0aec8" }} />}
          placeholder="Search messages or users"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Online kullanıcılar (arkadaş listemden) */}
      <div className="chats-panel-online">
        {onlineUsersList.length > 0 ? (
          onlineUsersList.map((u) => (
            <div
              key={u.userName}
              className="online-user-card"
              onClick={(e) => {
                e.stopPropagation();
                if (activeConversationId !== u.id) {
                  navigate(`/chat/${u.id}`);
                }
              }}
            >
              <div className="online-user-avatar-wrapper">
                <Avatar
                  size={44}
                  src={avatarUrl(u.avatar)}
                  style={{
                    background: "var(--color-primary)",
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  {u.fullName.charAt(0)}
                </Avatar>
                <div className="online-user-dot" />
              </div>
              <Text className="online-user-name">{u.fullName}</Text>
            </div>
          ))
        ) : (
          <Text style={{ fontSize: 12, color: "#aaa", padding: "0 4px" }}>
            Online kullanıcı yok
          </Text>
        )}
      </div>

      <div className="chats-panel-recent-title">Recent</div>

      {/* Kullanıcı listesi (yazıştıklarım) */}
      <div className="chats-panel-list">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((u) => {
            const count = unreadCount(u.id);
            const unread = count > 0;
            const isLongPressed = longPressUser?.id === u.id;

            return (
              <div
                key={u.userName}
                className={`chats-panel-item ${activeConversationId === u.id ? "active" : ""} ${isLongPressed ? "long-pressed" : ""}`}
                style={{ position: "relative" }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (longPressUser) {
                    setLongPressUser(null);
                    return;
                  }
                  if (activeConversationId !== u.id) {
                    navigate(`/chat/${u.id}`);
                  }
                }}
                onTouchStart={() => startLongPress(u)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
              >
                <Badge
                  dot
                  color={isUserOnline(u.id) ? "#52c41a" : "transparent"}
                  offset={[-3, 38]}
                >
                  <Avatar
                    size={42}
                    src={avatarUrl(u.avatar)}
                    style={{
                      background: "var(--color-primary)",
                      flexShrink: 0,
                      fontSize: 16,
                      fontWeight: 600,
                    }}
                  >
                    {u.fullName.charAt(0)}
                  </Avatar>
                </Badge>
                <div className="chats-panel-item-info">
                  <div className="chats-panel-item-top">
                    <Text
                      className="chats-panel-item-name"
                      style={{
                        fontWeight: unread ? 800 : 600,
                        color: unread ? "#111" : undefined,
                      }}
                    >
                      {u.fullName}
                    </Text>
                  </div>
                  <div className="chats-panel-item-bottom">
                    <Text
                      className="chats-panel-item-last-msg"
                      style={{
                        color: unread
                          ? "var(--color-primary)"
                          : isUserOnline(u.id)
                            ? "var(--color-primary)"
                            : "#aaa",
                        fontWeight: unread ? 700 : 400,
                        fontSize: unread ? 13 : undefined,
                      }}
                    >
                      {unread
                        ? `${count} yeni mesaj`
                        : isUserOnline(u.id)
                          ? "çevrimiçi"
                          : formatLastSeen(u.lastSeen)}
                    </Text>
                  </div>
                </div>

                {unread && <span className="chats-unread-badge">{count}</span>}

                {/* Masaüstü: 3 nokta (hover'da görünür) */}
                <div
                  className="chats-item-more header-desktop-icon"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Dropdown
                    trigger={["click"]}
                    placement="bottomRight"
                    menu={{
                      items: [
                        {
                          key: "delete",
                          label: "Sohbeti Sil",
                          icon: <DeleteOutlined />,
                          danger: true,
                          onClick: () => confirmDelete(u),
                        },
                      ],
                    }}
                  >
                    <MoreOutlined
                      style={{ fontSize: 16, color: "#aaa", padding: 4 }}
                    />
                  </Dropdown>
                </div>

                {/* Mobil: long-press menüsü */}
                {isLongPressed && (
                  <div
                    className="chats-longpress-menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className="chats-longpress-item danger"
                      onClick={() => {
                        setLongPressUser(null);
                        confirmDelete(u);
                      }}
                    >
                      <DeleteOutlined />
                      <span>Sohbeti Sil</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <Text style={{ fontSize: 12, color: "#aaa", padding: "0 4px" }}>
            Kullanıcı bulunamadı
          </Text>
        )}
      </div>
    </div>
  );
}

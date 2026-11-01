import {
  Avatar,
  Badge,
  Dropdown,
  Input,
  Modal,
  Skeleton,
  Typography,
  message as antdMessage,
} from "antd";
import {
  DeleteOutlined,
  MoreOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import agent from "../../api/requests";
import { useAppDispatch, useAppSelector } from "../../store/store";
import type { IUser } from "../../models/IUser";
import { avatarUrl } from "../../utils/avatarUrl";
import { formatLastSeen } from "../../utils/lastSeen";
import { getApiError } from "../../utils/apiError";
import { stagger } from "../../utils/animation";
import { cache } from "../../utils/cache";
import { useDelayedLoading } from "../../utils/useDelayedLoading";
import { clearActiveConversation } from "./chatSlice";
import "./ChatsPanel.css";

const { Text } = Typography;

const rememberUsers = (list: IUser[]) =>
  list.forEach((u) => cache.set(`user:${u.id}`, u));

function ChatListSkeleton() {
  return (
    <div className="chats-skeleton">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="chats-skeleton-row">
          <Skeleton.Avatar active size={42} />
          <div className="chats-skeleton-lines">
            <Skeleton.Input active size="small" block />
            <Skeleton.Input active size="small" className="chats-skeleton-short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChatsPanel() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { onlineUsers, activeConversationId, isRoom, unreadCounts } =
    useAppSelector((state) => state.chat);

  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<IUser[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [longPressUser, setLongPressUser] = useState<IUser | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSkeleton = useDelayedLoading(loading, 120);

  const loadConversations = useCallback(() => {
    agent.Message.getConversations()
      .then((list: IUser[]) => {
        setUsers(list);
        rememberUsers(list);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<{ isRoom?: boolean }>).detail?.isRoom) return;
      loadConversations();
    };
    window.addEventListener("messageReceived", handler);
    return () => window.removeEventListener("messageReceived", handler);
  }, [loadConversations]);

  useEffect(() => {
    const load = () => {
      agent.Block.getBlocked()
        .then(setBlockedIds)
        .catch(() => undefined);
    };
    load();
    window.addEventListener("blockStatusChanged", load);
    return () => window.removeEventListener("blockStatusChanged", load);
  }, []);

  useEffect(() => {
    const load = () => {
      agent.Friendship.getFriends()
        .then((list: IUser[]) => {
          setFriends(list);
          rememberUsers(list);
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener("friendRequestAccepted", load);
    window.addEventListener("friendRemoved", load);
    window.addEventListener("blockStatusChanged", load);
    return () => {
      window.removeEventListener("friendRequestAccepted", load);
      window.removeEventListener("friendRemoved", load);
      window.removeEventListener("blockStatusChanged", load);
    };
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

  const term = searchTerm.trim().toLocaleLowerCase("tr");

  const filteredUsers = useMemo(
    () =>
      term
        ? users.filter(
            (u) =>
              u.fullName.toLocaleLowerCase("tr").includes(term) ||
              u.userName.toLocaleLowerCase("tr").includes(term),
          )
        : users,
    [users, term],
  );

  const isUserOnline = (id: string) =>
    onlineUsers.includes(id) && !blockedIds.includes(id);

  const onlineFriends = friends.filter((u) => isUserOnline(u.id));

  const openChat = (id: string) => {
    if (activeConversationId !== id || isRoom) {
      navigate(`/chat/${id}`);
    }
  };

  const confirmDelete = (u: IUser) => {
    Modal.confirm({
      title: "Sohbeti Sil",
      content: `"${u.fullName}" ile olan sohbet sizin için silinecek. Yeni mesaj gelirse sohbet tekrar görünür.`,
      okText: "Sil",
      okType: "danger",
      cancelText: "İptal",
      onOk: async () => {
        try {
          await agent.Message.deleteConversation(u.id);
          setUsers((prev) => prev.filter((usr) => usr.id !== u.id));
          if (activeConversationId === u.id) {
            dispatch(clearActiveConversation());
            navigate("/");
          }
          antdMessage.success("Sohbet silindi");
        } catch (error) {
          antdMessage.error(getApiError(error, "Sohbet silinemedi"));
        }
      },
    });
  };

  const startLongPress = (u: IUser) => {
    longPressTimer.current = setTimeout(() => setLongPressUser(u), 450);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const renderList = () => {
    if (loading) return showSkeleton ? <ChatListSkeleton /> : null;

    if (filteredUsers.length === 0) {
      return (
        <Text className="chats-panel-empty">
          {term
            ? "Sonuç bulunamadı."
            : "Henüz sohbet yok. Kişiler sekmesinden bir arkadaşınla sohbet başlatabilirsin."}
        </Text>
      );
    }

    return filteredUsers.map((u, index) => {
      const count = unreadCounts[u.id] || 0;
      const unread = count > 0;
      const online = isUserOnline(u.id);
      const active = !isRoom && activeConversationId === u.id;
      const isLongPressed = longPressUser?.id === u.id;

      return (
        <div
          key={u.id}
          className={`chats-panel-item anim anim-fade-up ${active ? "active" : ""} ${isLongPressed ? "long-pressed" : ""} ${unread ? "is-unread" : ""}`}
          style={stagger(index)}
          onClick={(e) => {
            e.stopPropagation();
            if (longPressUser) {
              setLongPressUser(null);
              return;
            }
            openChat(u.id);
          }}
          onTouchStart={() => startLongPress(u)}
          onTouchEnd={cancelLongPress}
          onTouchMove={cancelLongPress}
        >
          <Badge dot={online} color="#52c41a" offset={[-4, 36]}>
            <Avatar size={42} src={avatarUrl(u.avatar)} className="chats-avatar">
              {u.fullName.charAt(0).toUpperCase()}
            </Avatar>
          </Badge>

          <div className="chats-panel-item-info">
            <Text className="chats-panel-item-name">{u.fullName}</Text>
            <Text
              className={`chats-panel-item-status ${unread || online ? "is-highlight" : ""}`}
            >
              {unread
                ? `${count} yeni mesaj`
                : online
                  ? "çevrimiçi"
                  : formatLastSeen(u.lastSeen)}
            </Text>
          </div>

          {unread && <span className="chats-unread-badge anim anim-pop">{count}</span>}

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
              <MoreOutlined className="chats-item-more-icon" />
            </Dropdown>
          </div>

          {isLongPressed && (
            <div
              className="chats-longpress-menu anim anim-pop"
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
    });
  };

  return (
    <div
      className="chats-panel"
      onClick={() => {
        dispatch(clearActiveConversation());
        navigate("/");
      }}
    >
      {longPressUser && (
        <div className="chats-overlay" onClick={() => setLongPressUser(null)} />
      )}

      <div className="chats-panel-header">Sohbetler</div>

      <div className="chats-panel-search" onClick={(e) => e.stopPropagation()}>
        <Input
          prefix={<SearchOutlined className="chats-search-icon" />}
          placeholder="Sohbetlerde ara"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          maxLength={50}
          allowClear
        />
      </div>

      {onlineFriends.length > 0 && (
        <>
          <div className="chats-section-title">Çevrimiçi</div>
          <div className="chats-panel-online" onClick={(e) => e.stopPropagation()}>
            {onlineFriends.map((u) => (
              <button
                key={u.id}
                type="button"
                className="online-user-card anim anim-pop"
                onClick={() => openChat(u.id)}
              >
                <div className="online-user-avatar-wrapper">
                  <Avatar size={44} src={avatarUrl(u.avatar)} className="online-user-avatar">
                    {u.fullName.charAt(0).toUpperCase()}
                  </Avatar>
                  <span className="online-user-dot" />
                </div>
                <Text className="online-user-name">{u.fullName}</Text>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="chats-section-title">Son sohbetler</div>

      <div className="chats-panel-list">{renderList()}</div>
    </div>
  );
}
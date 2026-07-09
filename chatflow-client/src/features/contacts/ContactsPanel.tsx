import {
  Avatar,
  Input,
  Typography,
  Badge,
  Dropdown,
  Modal,
  Button,
  Image,
  message as antdMessage,
} from "antd";
import {
  SearchOutlined,
  UsergroupAddOutlined,
  MoreOutlined,
  UserAddOutlined,
  CheckOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import agent from "../../api/requests";
import { useAppSelector } from "../../store/store";
import type { IUser } from "../../models/IUser";
import { avatarUrl } from "../../utils/avatarUrl";
import "./ContactsPanel.css";

const { Text } = Typography;

interface Friend {
  id: string;
  fullName: string;
  userName: string;
  avatar?: string;
  bio?: string;
}

interface FriendRequest {
  id: string;
  fullName: string;
  userName: string;
  avatar?: string;
}

export default function ContactsPanel() {
  const navigate = useNavigate();
  const { user: currentUser } = useAppSelector((state) => state.auth);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [allUsers, setAllUsers] = useState<IUser[]>([]);
  const [sentIds, setSentIds] = useState<string[]>([]); // gönderdiğim bekleyen istekler
  const [search, setSearch] = useState("");
  const [requestsOpen, setRequestsOpen] = useState(false);

  const loadFriends = () =>
    agent.Friendship.getFriends()
      .then(setFriends)
      .catch(() => {});
  const loadRequests = () =>
    agent.Friendship.getRequests()
      .then(setRequests)
      .catch(() => {});
  const loadSent = () =>
    agent.Friendship.getSent()
      .then(setSentIds)
      .catch(() => {});

  useEffect(() => {
    loadFriends();
    loadRequests();
    loadSent();
    agent.User.getUsers()
      .then((all: IUser[]) =>
        setAllUsers(all.filter((u) => u.id !== currentUser?.id)),
      )
      .catch(() => {});
  }, []);

  // Anlık: istek gelince/kabul edilince/çıkarılınca yenile
  useEffect(() => {
    const onReceived = () => {
      loadRequests();
      loadSent();
    };
    const onAccepted = () => {
      loadFriends();
      loadSent();
    };
    const onRemoved = () => loadFriends();
    const onBlockChanged = () => loadFriends(); // engelleme arkadaşlığı silebilir

    window.addEventListener("friendRequestReceived", onReceived);
    window.addEventListener("friendRequestAccepted", onAccepted);
    window.addEventListener("friendRemoved", onRemoved);
    window.addEventListener("blockStatusChanged", onBlockChanged);
    return () => {
      window.removeEventListener("friendRequestReceived", onReceived);
      window.removeEventListener("friendRequestAccepted", onAccepted);
      window.removeEventListener("friendRemoved", onRemoved);
      window.removeEventListener("blockStatusChanged", onBlockChanged);
    };
  }, []);

  const friendIds = new Set(friends.map((f) => f.id));

  const searchResults =
    search.trim().length > 0
      ? allUsers.filter(
          (u) =>
            !friendIds.has(u.id) &&
            (u.userName.toLowerCase().includes(search.toLowerCase()) ||
              u.fullName.toLowerCase().includes(search.toLowerCase())),
        )
      : [];

  const handleSendRequest = async (userId: string) => {
    try {
      await agent.Friendship.sendRequest(userId);
      setSentIds((prev) => [...prev, userId]);
      antdMessage.success("İstek gönderildi");
    } catch (err: any) {
      antdMessage.error(err?.response?.data?.message ?? "İstek gönderilemedi");
    }
  };

  const handleCancel = async (userId: string) => {
    try {
      await agent.Friendship.cancel(userId);
      setSentIds((prev) => prev.filter((id) => id !== userId));
      antdMessage.success("İstek iptal edildi");
    } catch {
      antdMessage.error("İşlem başarısız");
    }
  };

  const handleAccept = async (userId: string) => {
    try {
      await agent.Friendship.accept(userId);
      setRequests((prev) => prev.filter((r) => r.id !== userId));
      loadFriends();
      antdMessage.success("Arkadaşlık kabul edildi");
    } catch {
      antdMessage.error("İşlem başarısız");
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await agent.Friendship.reject(userId);
      setRequests((prev) => prev.filter((r) => r.id !== userId));
    } catch {
      antdMessage.error("İşlem başarısız");
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await agent.Friendship.remove(userId);
      setFriends((prev) => prev.filter((f) => f.id !== userId));
      antdMessage.success("Arkadaşlıktan çıkarıldı");
    } catch {
      antdMessage.error("İşlem başarısız");
    }
  };

  const confirmRemove = (friend: Friend) => {
    Modal.confirm({
      title: "Listeden çıkar",
      content: `${friend.fullName} kişisini arkadaş listenizden çıkarmak istiyor musunuz?`,
      okText: "Çıkar",
      okType: "danger",
      cancelText: "İptal",
      onOk: () => handleRemove(friend.id),
    });
  };

  const grouped = [...friends]
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "tr"))
    .reduce<Record<string, Friend[]>>((acc, f) => {
      const letter = f.fullName.charAt(0).toUpperCase();
      (acc[letter] = acc[letter] || []).push(f);
      return acc;
    }, {});

  const sortedLetters = Object.keys(grouped).sort((a, b) =>
    a.localeCompare(b, "tr"),
  );

  return (
    <div className="contacts-panel">
      {/* Header */}
      <div className="contacts-panel-header">
        <Text className="contacts-panel-title">
          Contacts{" "}
          {friends.length > 0 && (
            <span
              style={{
                fontSize: 14,
                fontWeight: 400,
                color: "#aaa",
                marginLeft: 4,
              }}
            >
              ({friends.length})
            </span>
          )}
        </Text>
        <Badge count={requests.length} size="small">
          <UsergroupAddOutlined
            className="contacts-panel-header-icon"
            style={{ color: "var(--color-primary)" }}
            onClick={() => setRequestsOpen(true)}
          />
        </Badge>
      </div>

      {/* Arama */}
      <div className="contacts-panel-search">
        <Input
          prefix={<SearchOutlined style={{ color: "#b0aec8" }} />}
          placeholder="Kullanıcı adıyla ara ve ekle"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Liste */}
      <div className="contacts-panel-list">
        {search.trim().length > 0 ? (
          searchResults.length > 0 ? (
            searchResults.map((u) => {
              const isSent = sentIds.includes(u.id);
              return (
                <div
                  key={u.id}
                  className="contacts-panel-item"
                  style={{ cursor: "default" }}
                >
                  {/* Avatar — tıklayınca büyük önizleme */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ flexShrink: 0 }}
                  >
                    {u.avatar ? (
                      <Image
                        src={avatarUrl(u.avatar)}
                        width={36}
                        height={36}
                        style={{
                          borderRadius: "50%",
                          objectFit: "cover",
                          cursor: "pointer",
                        }}
                        preview={{ mask: null }}
                      />
                    ) : (
                      <Avatar
                        size={36}
                        style={{
                          background: "var(--color-primary)",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {u.fullName.charAt(0).toUpperCase()}
                      </Avatar>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#333",
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {u.fullName}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#aaa" }}>
                      @{u.userName}
                    </Text>
                  </div>

                  {isSent ? (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <Button size="small" disabled>
                        Gönderildi
                      </Button>
                      <Button
                        size="small"
                        danger
                        onClick={() => handleCancel(u.id)}
                      >
                        İptal
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="small"
                      type="primary"
                      icon={<UserAddOutlined />}
                      onClick={() => handleSendRequest(u.id)}
                      style={{
                        background: "var(--color-primary)",
                        borderColor: "var(--color-primary)",
                        flexShrink: 0,
                      }}
                    >
                      Ekle
                    </Button>
                  )}
                </div>
              );
            })
          ) : (
            <Text
              style={{
                color: "#aaa",
                fontSize: 13,
                padding: "8px",
                display: "block",
              }}
            >
              Kullanıcı bulunamadı
            </Text>
          )
        ) : friends.length === 0 ? (
          <Text
            style={{
              color: "#aaa",
              fontSize: 13,
              padding: "8px",
              display: "block",
            }}
          >
            Henüz kişi eklemediniz. Yukarıdan kullanıcı adıyla arayıp
            ekleyebilirsiniz.
          </Text>
        ) : (
          sortedLetters.map((letter) => (
            <div key={letter}>
              <Text className="contacts-panel-letter">{letter}</Text>
              {grouped[letter].map((f) => (
                <div
                  key={f.id}
                  className="contacts-panel-item"
                  onClick={() => navigate(`/chat/${f.id}`)}
                >
                  {/* Avatar — tıklayınca büyük önizleme (sohbete gitmesin) */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ flexShrink: 0 }}
                  >
                    {f.avatar ? (
                      <Image
                        src={avatarUrl(f.avatar)}
                        width={36}
                        height={36}
                        style={{
                          borderRadius: "50%",
                          objectFit: "cover",
                          cursor: "pointer",
                        }}
                        preview={{ mask: null }}
                      />
                    ) : (
                      <Avatar
                        size={36}
                        style={{
                          background: "var(--color-primary)",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {f.fullName.charAt(0).toUpperCase()}
                      </Avatar>
                    )}
                  </div>

                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#333",
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.fullName}
                  </Text>

                  <div onClick={(e) => e.stopPropagation()}>
                    <Dropdown
                      trigger={["click"]}
                      menu={{
                        items: [
                          {
                            key: "remove",
                            label: "Listemden çıkar",
                            danger: true,
                            onClick: () => confirmRemove(f),
                          },
                        ],
                      }}
                    >
                      <MoreOutlined className="contacts-panel-more" />
                    </Dropdown>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* İstekler modalı */}
      <Modal
        title="Arkadaşlık İstekleri"
        open={requestsOpen}
        onCancel={() => setRequestsOpen(false)}
        footer={null}
      >
        {requests.length === 0 ? (
          <Text style={{ color: "#aaa" }}>Bekleyen istek yok.</Text>
        ) : (
          requests.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              {r.avatar ? (
                <Image
                  src={avatarUrl(r.avatar)}
                  width={40}
                  height={40}
                  style={{
                    borderRadius: "50%",
                    objectFit: "cover",
                    cursor: "pointer",
                  }}
                  preview={{ mask: null }}
                />
              ) : (
                <Avatar
                  size={40}
                  style={{
                    background: "var(--color-primary)",
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  {r.fullName.charAt(0).toUpperCase()}
                </Avatar>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text strong style={{ display: "block" }}>
                  {r.fullName}
                </Text>
                <Text style={{ fontSize: 12, color: "#aaa" }}>
                  @{r.userName}
                </Text>
              </div>
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => handleAccept(r.id)}
                style={{
                  background: "var(--color-primary)",
                  borderColor: "var(--color-primary)",
                }}
              >
                Kabul
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => handleReject(r.id)}
              >
                Reddet
              </Button>
            </div>
          ))
        )}
      </Modal>
    </div>
  );
}

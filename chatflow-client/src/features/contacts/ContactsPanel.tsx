import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  Image,
  Input,
  Modal,
  Skeleton,
  Typography,
  message as antdMessage,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  MoreOutlined,
  SearchOutlined,
  UserAddOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import agent from "../../api/requests";
import { avatarUrl } from "../../utils/avatarUrl";
import { getApiError } from "../../utils/apiError";
import { stagger } from "../../utils/animation";
import "./ContactsPanel.css";

const { Text } = Typography;

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DELAY_MS = 350;

interface ContactUser {
  id: string;
  fullName: string;
  userName: string;
  avatar?: string;
  bio?: string;
}

function UserAvatar({ user, size }: { user: ContactUser; size: number }) {
  if (user.avatar) {
    return (
      <Image
        src={avatarUrl(user.avatar)}
        width={size}
        height={size}
        className="contacts-avatar-image"
        preview={{ mask: null }}
        alt={user.fullName}
      />
    );
  }

  return (
    <Avatar size={size} className="contacts-avatar-fallback">
      {user.fullName.charAt(0).toUpperCase()}
    </Avatar>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="contacts-skeleton">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="contacts-skeleton-row">
          <Skeleton.Avatar active size={36} />
          <Skeleton.Input active size="small" block />
        </div>
      ))}
    </div>
  );
}

export default function ContactsPanel() {
  const navigate = useNavigate();

  const [friends, setFriends] = useState<ContactUser[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [requests, setRequests] = useState<ContactUser[]>([]);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [requestsOpen, setRequestsOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ContactUser[]>([]);
  const [searching, setSearching] = useState(false);

  const loadFriends = useCallback(
    () =>
      agent.Friendship.getFriends()
        .then(setFriends)
        .catch(() => undefined)
        .finally(() => setFriendsLoading(false)),
    [],
  );

  const loadRequests = useCallback(
    () =>
      agent.Friendship.getRequests()
        .then(setRequests)
        .catch(() => undefined),
    [],
  );

  const loadSent = useCallback(
    () =>
      agent.Friendship.getSent()
        .then(setSentIds)
        .catch(() => undefined),
    [],
  );

  useEffect(() => {
    loadFriends();
    loadRequests();
    loadSent();
  }, [loadFriends, loadRequests, loadSent]);

  useEffect(() => {
    const onReceived = () => {
      loadRequests();
      loadSent();
    };
    const onAccepted = () => {
      loadFriends();
      loadSent();
    };

    window.addEventListener("friendRequestReceived", onReceived);
    window.addEventListener("friendRequestAccepted", onAccepted);
    window.addEventListener("friendRemoved", loadFriends);
    window.addEventListener("blockStatusChanged", loadFriends);
    return () => {
      window.removeEventListener("friendRequestReceived", onReceived);
      window.removeEventListener("friendRequestAccepted", onAccepted);
      window.removeEventListener("friendRemoved", loadFriends);
      window.removeEventListener("blockStatusChanged", loadFriends);
    };
  }, [loadFriends, loadRequests, loadSent]);

  const term = search.trim();
  const isSearching = term.length > 0;

  useEffect(() => {
    if (term.length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const timer = setTimeout(() => {
      agent.User.search(term)
        .then((users: ContactUser[]) => {
          if (!cancelled) setSearchResults(users);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);
  const incomingIds = useMemo(
    () => new Set(requests.map((r) => r.id)),
    [requests],
  );

  const visibleResults = searchResults.filter((u) => !friendIds.has(u.id));

  const handleSendRequest = async (userId: string) => {
    try {
      await agent.Friendship.sendRequest(userId);
      setSentIds((prev) => [...prev, userId]);
      antdMessage.success("İstek gönderildi");
    } catch (error) {
      antdMessage.error(getApiError(error, "İstek gönderilemedi"));
    }
  };

  const handleCancel = async (userId: string) => {
    try {
      await agent.Friendship.cancel(userId);
      setSentIds((prev) => prev.filter((id) => id !== userId));
      antdMessage.success("İstek iptal edildi");
    } catch (error) {
      antdMessage.error(getApiError(error, "İşlem başarısız"));
    }
  };

  const handleAccept = async (userId: string) => {
    try {
      await agent.Friendship.accept(userId);
      setRequests((prev) => prev.filter((r) => r.id !== userId));
      loadFriends();
      antdMessage.success("Arkadaşlık isteği kabul edildi");
    } catch (error) {
      antdMessage.error(getApiError(error, "İşlem başarısız"));
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await agent.Friendship.reject(userId);
      setRequests((prev) => prev.filter((r) => r.id !== userId));
    } catch (error) {
      antdMessage.error(getApiError(error, "İşlem başarısız"));
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await agent.Friendship.remove(userId);
      setFriends((prev) => prev.filter((f) => f.id !== userId));
      antdMessage.success("Arkadaşlıktan çıkarıldı");
    } catch (error) {
      antdMessage.error(getApiError(error, "İşlem başarısız"));
    }
  };

  const confirmRemove = (friend: ContactUser) => {
    Modal.confirm({
      title: "Listeden çıkar",
      content: `${friend.fullName} kişisini arkadaş listenizden çıkarmak istiyor musunuz?`,
      okText: "Çıkar",
      okType: "danger",
      cancelText: "İptal",
      onOk: () => handleRemove(friend.id),
    });
  };

  const { grouped, letters } = useMemo(() => {
    const groups = [...friends]
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "tr"))
      .reduce<Record<string, ContactUser[]>>((acc, friend) => {
        const letter = friend.fullName.charAt(0).toLocaleUpperCase("tr");
        (acc[letter] ??= []).push(friend);
        return acc;
      }, {});

    return {
      grouped: groups,
      letters: Object.keys(groups).sort((a, b) => a.localeCompare(b, "tr")),
    };
  }, [friends]);

  const renderSearchAction = (user: ContactUser) => {
    if (incomingIds.has(user.id)) {
      return (
        <Button
          size="small"
          type="primary"
          icon={<CheckOutlined />}
          onClick={() => handleAccept(user.id)}
          className="contacts-primary-btn"
        >
          Kabul et
        </Button>
      );
    }

    if (sentIds.includes(user.id)) {
      return (
        <Button size="small" onClick={() => handleCancel(user.id)}>
          İsteği geri al
        </Button>
      );
    }

    return (
      <Button
        size="small"
        type="primary"
        icon={<UserAddOutlined />}
        onClick={() => handleSendRequest(user.id)}
        className="contacts-primary-btn"
      >
        Ekle
      </Button>
    );
  };

  const renderSearch = () => {
    if (term.length < MIN_SEARCH_LENGTH) {
      return (
        <Text className="contacts-panel-empty">
          Aramak için en az {MIN_SEARCH_LENGTH} karakter yazın.
        </Text>
      );
    }

    if (searching) return <ListSkeleton rows={3} />;

    if (visibleResults.length === 0) {
      return <Text className="contacts-panel-empty">Kullanıcı bulunamadı.</Text>;
    }

    return visibleResults.map((user, index) => (
      <div
        key={user.id}
        className="contacts-panel-item contacts-panel-item-static anim anim-fade-up"
        style={stagger(index)}
      >
        <div className="contacts-avatar">
          <UserAvatar user={user} size={36} />
        </div>
        <div className="contacts-panel-info">
          <Text className="contacts-panel-name">{user.fullName}</Text>
          <Text className="contacts-panel-username">@{user.userName}</Text>
        </div>
        <div className="contacts-panel-action">{renderSearchAction(user)}</div>
      </div>
    ));
  };

  const renderFriends = () => {
    if (friendsLoading) return <ListSkeleton rows={6} />;

    if (friends.length === 0) {
      return (
        <Text className="contacts-panel-empty">
          Henüz kişi eklemediniz. Yukarıdan isim veya kullanıcı adıyla arayıp
          ekleyebilirsiniz.
        </Text>
      );
    }

    return letters.map((letter) => (
      <div key={letter}>
        <Text className="contacts-panel-letter">{letter}</Text>
        {grouped[letter].map((friend, index) => (
          <div
            key={friend.id}
            className="contacts-panel-item anim anim-fade-up"
            style={stagger(index)}
            onClick={() => navigate(`/chat/${friend.id}`)}
          >
            <div className="contacts-avatar" onClick={(e) => e.stopPropagation()}>
              <UserAvatar user={friend} size={36} />
            </div>
            <Text className="contacts-panel-name contacts-panel-info">
              {friend.fullName}
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
                      onClick: () => confirmRemove(friend),
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
    ));
  };

  return (
    <div className="contacts-panel">
      <div className="contacts-panel-header">
        <Text className="contacts-panel-title">
          Kişiler
          {friends.length > 0 && (
            <span className="contacts-panel-count">({friends.length})</span>
          )}
        </Text>
        <Badge count={requests.length} size="small">
          <button
            type="button"
            className="contacts-panel-header-btn"
            onClick={() => setRequestsOpen(true)}
            aria-label="Arkadaşlık istekleri"
          >
            <UsergroupAddOutlined />
          </button>
        </Badge>
      </div>

      <div className="contacts-panel-search">
        <Input
          prefix={<SearchOutlined className="contacts-search-icon" />}
          placeholder="İsim veya kullanıcı adıyla ara"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={50}
          allowClear
        />
      </div>

      <div className="contacts-panel-list">
        {isSearching ? renderSearch() : renderFriends()}
      </div>

      <Modal
        title="Arkadaşlık İstekleri"
        open={requestsOpen}
        onCancel={() => setRequestsOpen(false)}
        footer={null}
      >
        {requests.length === 0 ? (
          <Text type="secondary">Bekleyen istek yok.</Text>
        ) : (
          requests.map((request) => (
            <div key={request.id} className="contacts-request-item anim anim-fade-up">
              <UserAvatar user={request} size={40} />
              <div className="contacts-panel-info">
                <Text strong ellipsis>
                  {request.fullName}
                </Text>
                <Text className="contacts-panel-username">
                  @{request.userName}
                </Text>
              </div>
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => handleAccept(request.id)}
                className="contacts-primary-btn"
              >
                Kabul
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => handleReject(request.id)}
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
import {
  Avatar,
  Checkbox,
  Dropdown,
  Empty,
  Input,
  Modal,
  Skeleton,
  Typography,
  message,
} from "antd";
import {
  DeleteOutlined,
  MoreOutlined,
  SearchOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import agent from "../../api/requests";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { clearActiveConversation } from "../chats/chatSlice";
import type { IRoom } from "../../models/IRoom";
import type { IUser } from "../../models/IUser";
import { avatarUrl } from "../../utils/avatarUrl";
import { getApiError } from "../../utils/apiError";
import { stagger } from "../../utils/animation";
import { cache } from "../../utils/cache";
import { useDelayedLoading } from "../../utils/useDelayedLoading";
import "./GroupsPanel.css";

const { Text } = Typography;

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="groups-skeleton">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="groups-skeleton-row">
          <Skeleton.Avatar active size={40} />
          <Skeleton.Input active size="small" block />
        </div>
      ))}
    </div>
  );
}

export default function GroupsPanel() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const { activeConversationId, isRoom, unreadCounts } = useAppSelector(
    (state) => state.chat,
  );

  const [rooms, setRooms] = useState<IRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const showSkeleton = useDelayedLoading(loading, 120);

  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [friends, setFriends] = useState<IUser[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchRooms = useCallback(() => {
    agent.Room.getRooms()
      .then((list: IRoom[]) => {
        setRooms(list);
        list.forEach((room) => cache.set(`room:${room.id}`, room));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    window.addEventListener("removedFromRoom", fetchRooms);
    window.addEventListener("addedToRoom", fetchRooms);
    window.addEventListener("roomUpdated", fetchRooms);
    return () => {
      window.removeEventListener("removedFromRoom", fetchRooms);
      window.removeEventListener("addedToRoom", fetchRooms);
      window.removeEventListener("roomUpdated", fetchRooms);
    };
  }, [fetchRooms]);

  const openCreateModal = () => {
    setGroupName("");
    setSelectedMembers([]);
    setMemberSearch("");
    setCreateOpen(true);
    setFriendsLoading(true);

    agent.Friendship.getFriends()
      .then(setFriends)
      .catch((error) =>
        message.error(getApiError(error, "Arkadaş listesi alınamadı")),
      )
      .finally(() => setFriendsLoading(false));
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleCreateGroup = async () => {
    const name = groupName.trim();

    if (!name) {
      message.warning("Grup adı boş olamaz");
      return;
    }
    if (name.length > 50) {
      message.warning("Grup adı en fazla 50 karakter olabilir");
      return;
    }
    if (selectedMembers.length === 0) {
      message.warning("En az bir üye seçin");
      return;
    }

    setCreating(true);
    try {
      const room: IRoom = await agent.Room.createRoom({
        name,
        memberIds: selectedMembers,
      });
      cache.set(`room:${room.id}`, room);
      message.success("Grup oluşturuldu");
      setCreateOpen(false);
      fetchRooms();
      navigate(`/room/${room.id}`);
    } catch (error) {
      message.error(getApiError(error, "Grup oluşturulamadı"));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRoom = (room: IRoom) => {
    Modal.confirm({
      title: "Grubu Sil",
      content: `"${room.name}" grubu ve tüm mesajları silinecek. Bu işlem geri alınamaz.`,
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
        } catch (error) {
          message.error(getApiError(error, "Grup silinemedi"));
        }
      },
    });
  };

  const roomTerm = search.trim().toLocaleLowerCase("tr");
  const filteredRooms = useMemo(
    () =>
      roomTerm
        ? rooms.filter((r) => r.name.toLocaleLowerCase("tr").includes(roomTerm))
        : rooms,
    [rooms, roomTerm],
  );

  const friendTerm = memberSearch.trim().toLocaleLowerCase("tr");
  const filteredFriends = useMemo(
    () =>
      friendTerm
        ? friends.filter(
            (u) =>
              u.fullName.toLocaleLowerCase("tr").includes(friendTerm) ||
              u.userName.toLocaleLowerCase("tr").includes(friendTerm),
          )
        : friends,
    [friends, friendTerm],
  );

  const renderRooms = () => {
    if (loading) return showSkeleton ? <ListSkeleton rows={5} /> : null;

    if (filteredRooms.length === 0) {
      return (
        <div className="groups-panel-empty anim anim-fade">
          <Empty
            description={roomTerm ? "Sonuç bulunamadı" : "Henüz bir grubun yok"}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      );
    }

    return filteredRooms.map((room, index) => {
      const active = isRoom && activeConversationId === String(room.id);
      const isCreator = room.createdBy === currentUser?.id;
      const count = unreadCounts[String(room.id)] || 0;
      const unread = count > 0;

      return (
        <div
          key={room.id}
          className={`groups-panel-item anim anim-fade-up ${active ? "active" : ""} ${unread ? "is-unread" : ""}`}
          style={stagger(index)}
          onClick={() => {
            if (!active) navigate(`/room/${room.id}`);
          }}
        >
          <Avatar size={40} src={avatarUrl(room.avatar)} className="groups-avatar">
            {room.name.charAt(0).toUpperCase()}
          </Avatar>

          <div className="groups-panel-item-info">
            <Text className="groups-panel-item-name">#{room.name}</Text>
            {unread && (
              <Text className="groups-panel-item-status">{count} yeni mesaj</Text>
            )}
          </div>

          <div className="groups-panel-item-actions" onClick={(e) => e.stopPropagation()}>
            {unread && <span className="groups-unread-badge anim anim-pop">{count}</span>}

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
                <MoreOutlined className="groups-more-icon" />
              </Dropdown>
            )}
          </div>
        </div>
      );
    });
  };

  const renderFriends = () => {
    if (friendsLoading) return <ListSkeleton rows={4} />;

    if (friends.length === 0) {
      return (
        <Text type="secondary" className="groups-modal-empty">
          Gruba eklemek için önce arkadaş eklemelisin.
        </Text>
      );
    }

    if (filteredFriends.length === 0) {
      return (
        <Text type="secondary" className="groups-modal-empty">
          Sonuç bulunamadı.
        </Text>
      );
    }

    return filteredFriends.map((u) => (
      <div key={u.id} className="groups-member-item" onClick={() => toggleMember(u.id)}>
        <Checkbox checked={selectedMembers.includes(u.id)} />
        <Avatar size={32} src={avatarUrl(u.avatar)} className="groups-member-avatar">
          {u.fullName.charAt(0).toUpperCase()}
        </Avatar>
        <div className="groups-member-info">
          <Text ellipsis>{u.fullName}</Text>
          <Text type="secondary" className="groups-member-username">
            @{u.userName}
          </Text>
        </div>
      </div>
    ));
  };

  return (
    <div className="groups-panel">
      <div className="groups-panel-header">
        <Text className="groups-panel-header-title">Gruplar</Text>
        <button
          type="button"
          className="groups-panel-header-btn"
          onClick={openCreateModal}
          aria-label="Yeni grup oluştur"
        >
          <UsergroupAddOutlined />
        </button>
      </div>

      <div className="groups-panel-search">
        <Input
          prefix={<SearchOutlined className="groups-search-icon" />}
          placeholder="Gruplarda ara"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={50}
          allowClear
        />
      </div>

      <div className="groups-panel-list">{renderRooms()}</div>

      <Modal
        title="Yeni Grup Oluştur"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreateGroup}
        okText={
          selectedMembers.length > 0
            ? `Oluştur (${selectedMembers.length} üye)`
            : "Oluştur"
        }
        cancelText="İptal"
        confirmLoading={creating}
        okButtonProps={{ className: "groups-primary-btn" }}
      >
        <label className="groups-modal-field">
          <Text strong>Grup adı</Text>
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Örn. Proje ekibi"
            maxLength={50}
            showCount
          />
        </label>

        <div className="groups-modal-field">
          <Text strong>Üyeler</Text>
          <Input
            prefix={<SearchOutlined className="groups-search-icon" />}
            placeholder="Arkadaşlarında ara"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            allowClear
          />
          <div className="groups-member-list">{renderFriends()}</div>
        </div>
      </Modal>
    </div>
  );
}
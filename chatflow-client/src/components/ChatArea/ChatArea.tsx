import { Avatar, message } from "antd";
import { MessageOutlined } from "@ant-design/icons";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import MessageInput from "../MessageInput/MessageInput";
import ChatHeader from "./ChatHeader";
import MessageBubble from "./MessageBubble";
import MembersModal from "./MembersModal";
import AddMemberModal from "./AddMemberModal";
import UserDetailPanel from "../../features/profile/UserDetailPanel";
import GroupDetailPanel from "../../features/groups/GroupDetailPanel";
import { useAppDispatch, useAppSelector } from "../../store/store";
import agent from "../../api/requests";
import {
  clearActiveConversation,
  setMessages,
} from "../../features/chats/chatSlice";
import type { IUser } from "../../models/IUser";
import type { IRoom } from "../../models/IRoom";
import type { IRoomMember } from "../../models/IRoomMember";
import { signalRService } from "../../api/signalRService";
import { avatarUrl } from "../../utils/avatarUrl";
import { getApiError } from "../../utils/apiError";
import Animate from "../Animate/Animate";
import type { IMessage } from "../../models/IMessage";
import { cache } from "../../utils/cache";
import { useDelayedLoading } from "../../utils/useDelayedLoading";
import "./ChatArea.css";

const SKELETON_ROWS: { side: "left" | "right"; width: string }[] = [
  { side: "left", width: "55%" },
  { side: "right", width: "38%" },
  { side: "left", width: "42%" },
  { side: "left", width: "64%" },
  { side: "right", width: "50%" },
  { side: "right", width: "30%" },
  { side: "left", width: "46%" },
];

function MessagesSkeleton() {
  return (
    <div className="chat-skeleton" aria-label="Mesajlar yükleniyor">
      {SKELETON_ROWS.map((row, index) => (
        <div key={index} className={`chat-skeleton-row is-${row.side}`}>
          {row.side === "left" && <div className="chat-skeleton-avatar" />}
          <div className="chat-skeleton-bubble" style={{ width: row.width }} />
        </div>
      ))}
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="chat-welcome">
      <div className="es-wrap">
        <div className="es-icon-area">
          <div className="es-pulse" />
          <div className="es-pulse" />
          <div className="es-pulse" />
          <div className="es-chat-icon">
            <MessageOutlined className="es-chat-icon-svg" />
            <div className="es-mini-bubble es-mb1" />
            <div className="es-mini-bubble es-mb2" />
          </div>
        </div>
        <p className="es-title">ChatFlow'a hoş geldin</p>
        <p className="es-subtitle">
          Sohbet başlatmak için sol panelden bir kişi ya da grup seç.
        </p>
        <div className="es-dots">
          <div className="es-dot" />
          <div className="es-dot" />
          <div className="es-dot" />
        </div>
      </div>
    </div>
  );
}

export default function ChatArea() {
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const skipRef = useRef(0);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { messages, activeConversationId, isRoom, onlineUsers, typingUsers } =
    useAppSelector((state) => state.chat);
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const [activeUser, setActiveUser] = useState<IUser | null>(null);
  const [activeRoom, setActiveRoom] = useState<IRoom | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef<Set<number>>(new Set());
  const deliveredRef = useRef<Set<number>>(new Set());
  const isFirstScrollRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const isPrependingRef = useRef(false);
  const wasNearBottomRef = useRef(true);

  const [iBlocked, setIBlocked] = useState(false);
  const [blockedByThem, setBlockedByThem] = useState(false);
  const isBlocked = iBlocked || blockedByThem;

  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState<IRoomMember[]>([]);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<IUser[]>([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);

  const [detailOpen, setDetailOpen] = useState(false);
  const [baselineMessageId, setBaselineMessageId] = useState(0);

  const showSkeleton = useDelayedLoading(messagesLoading);

  const currentMember = members.find((m) => m.userId === currentUser?.id);
  const isCurrentUserAdmin = currentMember?.isAdmin ?? false;

  const matchingMessageIds = searchQuery.trim()
    ? messages
        .filter(
          (m) =>
            !m.isDeleted &&
            m.content.toLowerCase().includes(searchQuery.toLowerCase()),
        )
        .map((m) => m.id)
        .reverse()
    : [];

  const activeMatchId =
    matchingMessageIds.length > 0
      ? matchingMessageIds[matchIndex % matchingMessageIds.length]
      : null;

  useEffect(() => {
    if (!activeConversationId) return;

    let cancelled = false;
    const key = `messages:${isRoom ? "room" : "user"}:${activeConversationId}`;
    const cached = cache.get<{ messages: IMessage[]; hasMore: boolean }>(key);
    const highestId = (list: IMessage[]) =>
      list.reduce((max, m) => Math.max(max, m.id), 0);

    markedRef.current = new Set();
    deliveredRef.current = new Set();
    isFirstScrollRef.current = true;

    if (cached) {
      dispatch(setMessages(cached.messages));
      setHasMore(cached.hasMore);
      setBaselineMessageId(highestId(cached.messages));
      skipRef.current = cached.messages.length;
      setMessagesLoading(false);
    } else {
      skipRef.current = 0;
      setMessagesLoading(true);
    }

    agent.Message.getMessages(
      isRoom ? undefined : activeConversationId,
      isRoom ? Number(activeConversationId) : undefined,
      0,
    )
      .then((res: { messages: IMessage[]; hasMore: boolean }) => {
        if (cancelled) return;
        dispatch(setMessages(res.messages));
        setHasMore(res.hasMore);
        setBaselineMessageId(highestId(res.messages));
        skipRef.current = res.messages.length;
        cache.set(key, res);
      })
      .catch(() => {
        if (!cancelled && isRoom) {
          window.dispatchEvent(
            new CustomEvent("removedFromRoom", {
              detail: activeConversationId,
            }),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });

    if (isRoom) {
      const roomId = Number(activeConversationId);
      setActiveUser(null);
      setActiveRoom(cache.get<IRoom>(`room:${roomId}`) ?? null);
      setMembers(cache.get<IRoomMember[]>(`members:${roomId}`) ?? []);
      signalRService.joinRoom(roomId);

      agent.Room.getRoom(roomId)
        .then((room: IRoom) => {
          if (cancelled) return;
          cache.set(`room:${roomId}`, room);
          setActiveRoom(room);
        })
        .catch(() => undefined);

      agent.Room.getMembers(roomId)
        .then((mem: IRoomMember[]) => {
          if (cancelled) return;
          cache.set(`members:${roomId}`, mem);
          setMembers(mem);
        })
        .catch(() => undefined);
    } else {
      setActiveRoom(null);
      setMembers([]);
      setActiveUser(cache.get<IUser>(`user:${activeConversationId}`) ?? null);

      agent.User.getById(activeConversationId)
        .then((user: IUser) => {
          if (cancelled) return;
          cache.set(`user:${user.id}`, user);
          setActiveUser(user);
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
  }, [activeConversationId, isRoom]);

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setMatchIndex(0);
    setDetailOpen(false);
    setShowScrollButton(false);
    setHasNewMessage(false);
    wasNearBottomRef.current = true;
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId || isRoom) {
      setIBlocked(false);
      setBlockedByThem(false);
      return;
    }

    let cancelled = false;

    agent.Block.getStatus(activeConversationId)
      .then((res: { iBlocked: boolean; blockedByThem: boolean }) => {
        if (cancelled) return;
        setIBlocked(res.iBlocked);
        setBlockedByThem(res.blockedByThem);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [activeConversationId, isRoom]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { userId } = (e as CustomEvent).detail;
      if (activeConversationId && userId === activeConversationId && !isRoom) {
        agent.Block.getStatus(activeConversationId)
          .then((res: { iBlocked: boolean; blockedByThem: boolean }) => {
            setIBlocked(res.iBlocked);
            setBlockedByThem(res.blockedByThem);
          })
          .catch(() => undefined);
      }
    };
    window.addEventListener("blockStatusChanged", handler);
    return () => window.removeEventListener("blockStatusChanged", handler);
  }, [activeConversationId, isRoom]);

  useEffect(() => {
    if (!activeConversationId || isRoom) return;

    messages
      .filter(
        (m) =>
          m.senderId === activeConversationId &&
          !m.isRead &&
          !markedRef.current.has(m.id),
      )
      .forEach((m) => {
        markedRef.current.add(m.id);
        signalRService.markAsRead(m.id, m.senderId);
      });
  }, [messages, activeConversationId, isRoom]);

  useEffect(() => {
    if (!activeConversationId || !isRoom) return;

    messages
      .filter(
        (m) =>
          m.senderId !== currentUser?.id &&
          !m.isDeleted &&
          !markedRef.current.has(m.id),
      )
      .forEach((m) => {
        markedRef.current.add(m.id);
        signalRService.markAsRead(m.id, m.senderId);
      });
  }, [messages, activeConversationId, isRoom, currentUser?.id]);

  useEffect(() => {
    if (!activeConversationId || !isRoom) return;

    messages
      .filter(
        (m) =>
          m.senderId !== currentUser?.id &&
          !m.isDeleted &&
          !deliveredRef.current.has(m.id),
      )
      .forEach((m) => {
        deliveredRef.current.add(m.id);
        signalRService.markAsDelivered(m.id, m.senderId);
      });
  }, [messages, activeConversationId, isRoom, currentUser?.id]);

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || messages.length === 0) return;
    if (messagesLoading) return;

    if (isPrependingRef.current) {
      isPrependingRef.current = false;
      prevMessageCountRef.current = messages.length;
      return;
    }

    if (isFirstScrollRef.current) {
      container.scrollTop = container.scrollHeight;
      prevMessageCountRef.current = messages.length;
      isFirstScrollRef.current = false;
      return;
    }

    if (messages.length <= prevMessageCountRef.current) {
      prevMessageCountRef.current = messages.length;
      return;
    }
    prevMessageCountRef.current = messages.length;

    const lastMessage = messages[messages.length - 1];
    const isMyMessage = lastMessage?.senderId === currentUser?.id;

    if (isMyMessage || wasNearBottomRef.current) {
      container.scrollTop = container.scrollHeight;
      setHasNewMessage(false);
    } else {
      setHasNewMessage(true);
    }
  }, [messages, messagesLoading]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const distance =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      const isNearBottom = distance < 150;
      wasNearBottomRef.current = isNearBottom;
      setShowScrollButton(!isNearBottom);
      if (isNearBottom) setHasNewMessage(false);

      const hasScroll = container.scrollHeight > container.clientHeight + 50;
      if (hasScroll && container.scrollTop < 80) {
        loadMoreMessages();
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [activeConversationId, hasMore, loadingMore, messages]);

  useEffect(() => {
    if (activeMatchId == null) return;
    const el = document.getElementById(`message-${activeMatchId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeMatchId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (isRoom && activeRoom && data.id === activeRoom.id) {
        setActiveRoom((prev) =>
          prev
            ? {
                ...prev,
                name: data.name,
                description: data.description,
                avatar: data.avatar,
              }
            : prev,
        );
      }
    };
    window.addEventListener("roomUpdated", handler);
    return () => window.removeEventListener("roomUpdated", handler);
  }, [isRoom, activeRoom]);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
    setHasNewMessage(false);
  };

  const isOnline = activeUser ? onlineUsers.includes(activeUser.id) : false;

  const typingMemberNames = isRoom
    ? typingUsers
        .filter((id) => id !== currentUser?.id)
        .map((id) => members.find((m) => m.userId === id)?.fullName)
        .filter(Boolean)
    : [];

  const openMembersModal = () => {
    if (!isRoom || !activeConversationId) return;
    agent.Room.getMembers(Number(activeConversationId))
      .then((mem: IRoomMember[]) => {
        setMembers(mem);
        setMembersOpen(true);
      })
      .catch((error) => message.error(getApiError(error, "Üyeler alınamadı")));
  };

  const openAddMemberModal = () => {
    agent.Friendship.getFriends()
      .then((friends: IUser[]) => {
        const memberIds = new Set(members.map((m) => m.userId));
        setAllUsers(friends.filter((f) => !memberIds.has(f.id)));
        setSelectedNewMembers([]);
        setAddMemberOpen(true);
      })
      .catch((error) =>
        message.error(getApiError(error, "Arkadaş listesi alınamadı")),
      );
  };

  const toggleNewMember = (userId: string) => {
    setSelectedNewMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleAddMembers = async () => {
    if (!activeConversationId || selectedNewMembers.length === 0) return;
    try {
      for (const memberId of selectedNewMembers) {
        await agent.Room.addMember(Number(activeConversationId), memberId);
      }
      message.success("Üye(ler) eklendi");
      setAddMemberOpen(false);
      const mem = await agent.Room.getMembers(Number(activeConversationId));
      setMembers(mem);
    } catch (error) {
      message.error(getApiError(error, "Üye eklenemedi"));
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!activeConversationId) return;
    try {
      await agent.Room.removeMember(Number(activeConversationId), memberId);
      message.success("Üye çıkarıldı");
      setMembers((prev) => prev.filter((m) => m.userId !== memberId));
    } catch (error) {
      message.error(getApiError(error, "Üye çıkarılamadı"));
    }
  };

  const handleMakeAdmin = async (memberId: string) => {
    if (!activeConversationId) return;
    try {
      await agent.Room.makeAdmin(Number(activeConversationId), memberId);
      message.success("Yönetici yapıldı");
      setMembers((prev) =>
        prev.map((m) => (m.userId === memberId ? { ...m, isAdmin: true } : m)),
      );
    } catch (error) {
      message.error(getApiError(error, "Yöneticilik verilemedi"));
    }
  };

  const handleToggleBlock = async () => {
    if (!activeConversationId || isRoom) return;
    try {
      if (iBlocked) {
        await agent.Block.unblock(activeConversationId);
        setIBlocked(false);
        message.success("Engel kaldırıldı");
      } else {
        await agent.Block.block(activeConversationId);
        setIBlocked(true);
        message.success("Kullanıcı engellendi");
      }
      window.dispatchEvent(
        new CustomEvent("blockStatusChanged", {
          detail: { userId: activeConversationId },
        }),
      );
    } catch (error) {
      message.error(getApiError(error, "İşlem başarısız"));
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setMatchIndex(0);
  };

  const goToNextMatch = () => {
    if (matchingMessageIds.length === 0) return;
    setMatchIndex((prev) => Math.max(prev - 1, 0));
  };

  const goToPrevMatch = () => {
    if (matchingMessageIds.length === 0) return;
    setMatchIndex((prev) => Math.min(prev + 1, matchingMessageIds.length - 1));
  };

  if (!activeConversationId) {
    return <WelcomeScreen />;
  }

  const loadMoreMessages = async () => {
    if (loadingMore || !hasMore || !activeConversationId) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    setLoadingMore(true);
    const prevScrollHeight = container.scrollHeight;

    try {
      const res: { messages: any[]; hasMore: boolean } =
        await agent.Message.getMessages(
          isRoom ? undefined : activeConversationId,
          isRoom ? Number(activeConversationId) : undefined,
          skipRef.current,
        );

      isPrependingRef.current = true;
      dispatch(setMessages([...res.messages, ...messages]));
      setHasMore(res.hasMore);
      skipRef.current += res.messages.length;
      prevMessageCountRef.current = messages.length + res.messages.length;

      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight - prevScrollHeight;
      });
    } catch {
      return;
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="chat-area">
      <div className="chat-column">
        <ChatHeader
          isRoom={isRoom}
          activeUser={activeUser}
          activeRoom={activeRoom}
          isOnline={isOnline}
          isBlocked={isBlocked}
          iBlocked={iBlocked}
          onToggleBlock={handleToggleBlock}
          onBack={() => {
            dispatch(clearActiveConversation());
            navigate("/");
          }}
          onOpenDetails={() => setDetailOpen(true)}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setMatchIndex={setMatchIndex}
          matchIndex={matchIndex}
          matchingMessageIds={matchingMessageIds}
          goToNextMatch={goToNextMatch}
          goToPrevMatch={goToPrevMatch}
          closeSearch={closeSearch}
          openMembersModal={openMembersModal}
        />

        <div
          ref={messagesContainerRef}
          className="chat-messages"
          onClick={() => {
            if (searchOpen) closeSearch();
          }}
        >
          {messagesLoading ? (
            showSkeleton && <MessagesSkeleton />
          ) : (
            <>
              {loadingMore && (
                <div className="chat-load-more">
                  <div className="chat-skeleton-bubble chat-load-more-bar" />
                </div>
              )}
              <Animate type="fade" key={activeConversationId} duration={260}>
                {messages.map((msg) => {
                  const bubble = (
                    <MessageBubble
                      msg={msg}
                      currentUser={currentUser}
                      isRoom={isRoom}
                      activeUser={activeUser}
                      searchQuery={searchQuery}
                      matchingMessageIds={matchingMessageIds}
                      activeMatchId={activeMatchId}
                    />
                  );

                  return msg.id > baselineMessageId ? (
                    <Animate key={msg.id} type="pop">
                      {bubble}
                    </Animate>
                  ) : (
                    <div key={msg.id}>{bubble}</div>
                  );
                })}
              </Animate>
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {!isBlocked &&
          typingUsers.length > 0 &&
          (isRoom
            ? typingMemberNames.length > 0
            : typingUsers.includes(activeConversationId)) && (
            <div className="typing-indicator">
              {!isRoom && (
                <Avatar
                  size={26}
                  src={avatarUrl(activeUser?.avatar)}
                  className="typing-avatar"
                >
                  {activeUser?.fullName?.charAt(0)}
                </Avatar>
              )}
              <div className="typing-bubble">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
                <span className="typing-text">
                  {isRoom
                    ? `${typingMemberNames.join(", ")} yazıyor`
                    : "Yazıyor"}
                </span>
              </div>
            </div>
          )}

        {showScrollButton && (
          <button
            type="button"
            onClick={scrollToBottom}
            className={`chat-scroll-btn ${hasNewMessage ? "has-new" : ""}`}
          >
            {hasNewMessage ? "Yeni mesaj" : "Aşağı in"}
            <span className="chat-scroll-arrow">↓</span>
          </button>
        )}

        {isBlocked ? (
          <div className="chat-blocked-bar anim anim-fade-up">
            {iBlocked
              ? "Bu kullanıcıyı engellediniz. Mesajlaşmak için engeli kaldırın."
              : "Bu kullanıcıyla mesajlaşamazsınız."}
          </div>
        ) : (
          <MessageInput />
        )}

        <MembersModal
          open={membersOpen}
          onClose={() => setMembersOpen(false)}
          members={members}
          currentUser={currentUser}
          isCurrentUserAdmin={isCurrentUserAdmin}
          onOpenAddMember={openAddMemberModal}
          onMakeAdmin={handleMakeAdmin}
          onRemoveMember={handleRemoveMember}
        />

        <AddMemberModal
          open={addMemberOpen}
          onClose={() => setAddMemberOpen(false)}
          onOk={handleAddMembers}
          allUsers={allUsers}
          selectedNewMembers={selectedNewMembers}
          toggleNewMember={toggleNewMember}
        />
      </div>

      {detailOpen && !isRoom && activeUser && (
        <UserDetailPanel
          user={activeUser}
          isOnline={isOnline}
          onClose={() => setDetailOpen(false)}
        />
      )}

      {detailOpen && isRoom && activeRoom && (
        <GroupDetailPanel
          room={activeRoom}
          members={members}
          currentUser={currentUser}
          isCurrentUserAdmin={isCurrentUserAdmin}
          onClose={() => setDetailOpen(false)}
          onRoomUpdated={(updated) => setActiveRoom(updated)}
          onOpenAddMember={openAddMemberModal}
          onMakeAdmin={handleMakeAdmin}
          onRemoveMember={handleRemoveMember}
        />
      )}
    </div>
  );
}

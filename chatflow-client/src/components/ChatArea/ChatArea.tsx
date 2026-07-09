import { Avatar, message, Spin } from "antd";
import MessageInput from "../MessageInput/MessageInput";
import ChatHeader from "./ChatHeader";
import MessageBubble from "./MessageBubble";
import MembersModal from "./MembersModal";
import AddMemberModal from "./AddMemberModal";
import UserDetailPanel from "../../features/profile/UserDetailPanel";
import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { useAppSelector, useAppDispatch } from "../../store/store";
import agent from "../../api/requests";
import {
  setMessages,
  clearActiveConversation,
} from "../../features/chats/chatSlice";
import type { IUser } from "../../models/IUser";
import type { IRoom } from "../../models/IRoom";
import type { IRoomMember } from "../../models/IRoomMember";
import { signalRService } from "../../api/signalRService";
import GroupDetailPanel from "../../features/groups/GroupDetailPanel";
import { avatarUrl } from "../../utils/avatarUrl";
import { useNavigate } from "react-router-dom";
import { MessageOutlined } from "@ant-design/icons";
import "./ChatArea.css";

export default function ChatArea() {
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const skipRef = useRef(0);
  const dispatch = useAppDispatch();
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
  const navigate = useNavigate();
  const isPrependingRef = useRef(false);

  // Engelleme durumu
  const [iBlocked, setIBlocked] = useState(false);
  const [blockedByThem, setBlockedByThem] = useState(false);
  const isBlocked = iBlocked || blockedByThem;

  // Üye yönetimi
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState<IRoomMember[]>([]);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<IUser[]>([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);

  // Sohbet içi arama
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);

  // Kişi detay paneli
  const [detailOpen, setDetailOpen] = useState(false);

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

    markedRef.current = new Set();
    deliveredRef.current = new Set();
    isFirstScrollRef.current = true;

    setMessagesLoading(true);
    skipRef.current = 0;

    agent.Message.getMessages(
      isRoom ? undefined : activeConversationId,
      isRoom ? Number(activeConversationId) : undefined,
      0,
    )
      .then((res: { messages: any[]; hasMore: boolean }) => {
        if (cancelled) return;
        dispatch(setMessages(res.messages));
        setHasMore(res.hasMore);
        skipRef.current = res.messages.length;
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
      setActiveUser(null);
      signalRService.joinRoom(Number(activeConversationId));
      agent.Room.getRoom(Number(activeConversationId))
        .then((room: IRoom) => {
          if (cancelled) return;
          setActiveRoom(room);
        })
        .catch(() => {});
      agent.Room.getMembers(Number(activeConversationId))
        .then((mem: IRoomMember[]) => {
          if (cancelled) return;
          setMembers(mem);
        })
        .catch(() => {});
    } else {
      setActiveRoom(null);
      setMembers([]);
      agent.User.getUsers()
        .then((users: IUser[]) => {
          if (cancelled) return;
          const found = users.find((u) => u.id === activeConversationId);
          setActiveUser(found ?? null);
        })
        .catch(() => {});
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
  }, [activeConversationId]);

  // Engel durumunu çek (bireysel sohbet)
  useEffect(() => {
    if (!activeConversationId || isRoom) {
      setIBlocked(false);
      setBlockedByThem(false);
      return;
    }
    agent.Block.getStatus(activeConversationId)
      .then((res: { iBlocked: boolean; blockedByThem: boolean }) => {
        setIBlocked(res.iBlocked);
        setBlockedByThem(res.blockedByThem);
      })
      .catch(() => {});
  }, [activeConversationId, isRoom]);

  // Detay panelinden engel değişince header + mesaj kutusu güncellensin
  useEffect(() => {
    const handler = (e: Event) => {
      const { userId } = (e as CustomEvent).detail;
      if (activeConversationId && userId === activeConversationId && !isRoom) {
        agent.Block.getStatus(activeConversationId).then(
          (res: { iBlocked: boolean; blockedByThem: boolean }) => {
            setIBlocked(res.iBlocked);
            setBlockedByThem(res.blockedByThem);
          },
        );
      }
    };
    window.addEventListener("blockStatusChanged", handler);
    return () => window.removeEventListener("blockStatusChanged", handler);
  }, [activeConversationId, isRoom]);

  // Mesajlar değişince okundu yap (sadece bireysel sohbette)
  useEffect(() => {
    if (!activeConversationId || isRoom) return;

    const unreadFromOther = messages.filter(
      (m) =>
        m.senderId === activeConversationId &&
        !m.isRead &&
        !markedRef.current.has(m.id),
    );

    unreadFromOther.forEach((m) => {
      markedRef.current.add(m.id);
      signalRService.markAsRead(m.id, m.senderId);
    });
  }, [messages, activeConversationId, isRoom]);

  // Grup mesajlarını okundu yap (başkasının gönderdiği, henüz işaretlenmemiş)
  useEffect(() => {
    if (!activeConversationId || !isRoom) return;

    const unreadFromOthers = messages.filter(
      (m) =>
        m.senderId !== currentUser?.id &&
        !m.isDeleted &&
        !markedRef.current.has(m.id),
    );

    unreadFromOthers.forEach((m) => {
      markedRef.current.add(m.id);
      signalRService.markAsRead(m.id, m.senderId);
    });
  }, [messages, activeConversationId, isRoom, currentUser?.id]);

  // Grup mesajlarını "iletildi" işaretle (başkasının gönderdiği, henüz işaretlenmemiş)
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

  // Scroll yönetimi
  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || messages.length === 0) return;

    // Mesajlar hala yükleniyorsa (Spin gösteriliyor, mesajlar DOM'da değil) bekle
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

    // Mesaj SAYISI artmadıysa (reaksiyon, tik, silme gibi güncelleme) → scroll etme
    if (messages.length <= prevMessageCountRef.current) {
      prevMessageCountRef.current = messages.length;
      return;
    }
    prevMessageCountRef.current = messages.length;

    const lastMessage = messages[messages.length - 1];
    const isMyMessage = lastMessage?.senderId === currentUser?.id;

    if (isMyMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setHasNewMessage(false);
      return;
    }

    const distance =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distance < 150;

    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      setShowScrollButton(!isNearBottom);
      if (isNearBottom) setHasNewMessage(false);

      // Scroll gerçekten varsa VE en üste yaklaşıldıysa önceki mesajları yükle
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
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeMatchId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent).detail;
      // Sadece şu an açık olan grup ise güncelle
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    agent.Room.getMembers(Number(activeConversationId)).then(
      (mem: IRoomMember[]) => {
        setMembers(mem);
        setMembersOpen(true);
      },
    );
  };

  const openAddMemberModal = () => {
    agent.User.getUsers().then((users: IUser[]) => {
      const memberIds = members.map((m) => m.userId);
      setAllUsers(users.filter((u) => !memberIds.includes(u.id)));
      setSelectedNewMembers([]);
      setAddMemberOpen(true);
    });
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
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message ?? "Üye eklenemedi";
      message.error(errorMessage);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!activeConversationId) return;
    try {
      await agent.Room.removeMember(Number(activeConversationId), memberId);
      message.success("Üye çıkarıldı");
      setMembers((prev) => prev.filter((m) => m.userId !== memberId));
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message ?? "Üye çıkarılamadı";
      message.error(errorMessage);
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
    } catch {
      message.error("Yöneticilik verilemedi (yetkiniz olmayabilir)");
    }
  };

  // Engelle / engeli kaldır (header'dan)
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
    } catch {
      message.error("İşlem başarısız");
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setMatchIndex(0);
  };

  // Aşağı ok: daha yeni mesaja (listede geriye, çünkü liste yeni→eski sıralı)
  const goToNextMatch = () => {
    if (matchingMessageIds.length === 0) return;
    setMatchIndex((prev) => Math.max(prev - 1, 0));
  };

  // Yukarı ok: daha eski mesaja (listede ileriye)
  const goToPrevMatch = () => {
    if (matchingMessageIds.length === 0) return;
    setMatchIndex((prev) => Math.min(prev + 1, matchingMessageIds.length - 1));
  };

  {
    /* Hiçbir konuşma seçili değilken gösterilen animasyonlu karşılama ekranı */
  }
  if (!activeConversationId) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
        }}
      >
        <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes dot-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        @keyframes es-fade-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .es-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; animation: es-fade-in 0.6s ease both; }
        .es-icon-area { position: relative; width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; margin-bottom: 28px; }
        .es-pulse { position: absolute; width: 90px; height: 90px; border-radius: 50%; background: #166534; opacity: 0; animation: pulse-ring 2.4s ease-out infinite; }
        .es-pulse:nth-child(2) { animation-delay: 0.8s; }
        .es-pulse:nth-child(3) { animation-delay: 1.6s; }
        .es-chat-icon { position: relative; width: 80px; height: 80px; background: #166534; border-radius: 50%; display: flex; align-items: center; justify-content: center; animation: float 3.2s ease-in-out infinite; z-index: 1; }
        .es-mini-bubble { position: absolute; background: #dcf0e4; border-radius: 10px 10px 0 10px; animation: float 2.8s ease-in-out infinite; }
        .es-mb1 { width: 28px; height: 14px; top: 8px; right: 2px; animation-delay: 0.4s; }
        .es-mb2 { width: 20px; height: 10px; top: 26px; right: -6px; border-radius: 8px 8px 0 8px; animation-delay: 0.9s; }
        .es-title { font-size: 20px; font-weight: 500; color: #333; margin: 0 0 10px; text-align: center; }
        .es-subtitle { font-size: 14px; color: #aaa; text-align: center; max-width: 240px; line-height: 1.6; margin: 0 0 28px; }
        .es-dots { display: flex; gap: 7px; align-items: center; }
        .es-dot { width: 7px; height: 7px; border-radius: 50%; background: #166534; opacity: 0.35; animation: dot-bounce 1.4s ease-in-out infinite; }
        .es-dot:nth-child(2) { animation-delay: 0.2s; }
        .es-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
        <div className="es-wrap">
          <div className="es-icon-area">
            <div className="es-pulse" />
            <div className="es-pulse" />
            <div className="es-pulse" />
            <div className="es-chat-icon">
              <MessageOutlined style={{ fontSize: 38, color: "#fff" }} />
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

  const loadMoreMessages = async () => {
    if (loadingMore || !hasMore || !activeConversationId) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    setLoadingMore(true);

    // Yükleme öncesi scroll yüksekliğini kaydet (pozisyon korumak için)
    const prevScrollHeight = container.scrollHeight;

    try {
      const res: { messages: any[]; hasMore: boolean } =
        await agent.Message.getMessages(
          isRoom ? undefined : activeConversationId,
          isRoom ? Number(activeConversationId) : undefined,
          skipRef.current,
        );

      // Eski mesajları listenin BAŞINA ekle
      isPrependingRef.current = true;
      dispatch(setMessages([...res.messages, ...messages]));
      setHasMore(res.hasMore);
      skipRef.current += res.messages.length;
      prevMessageCountRef.current = messages.length + res.messages.length;

      // Scroll pozisyonunu koru: yeni eklenen içerik kadar aşağı kaydır
      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - prevScrollHeight;
        }
      });
    } catch {
      // sessizce geç
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        minWidth: 0,
        minHeight: 0,
        height: "100%",
        position: "relative",
      }}
    >
      {/* Sohbet kolonu */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: "100%",
          background: "#fff",
          position: "relative",
        }}
      >
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

        {/* Mesaj listesi */}
        <div
          ref={messagesContainerRef}
          onClick={() => {
            if (searchOpen) closeSearch();
          }}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
            background: "#fff",
          }}
        >
          {messagesLoading ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Spin size="large" />
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  currentUser={currentUser}
                  isRoom={isRoom}
                  activeUser={activeUser}
                  searchQuery={searchQuery}
                  matchingMessageIds={matchingMessageIds}
                  activeMatchId={activeMatchId}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Yazıyor göstergesi (engel yoksa) */}
        {!isBlocked &&
          typingUsers.length > 0 &&
          (isRoom
            ? typingMemberNames.length > 0
            : typingUsers.includes(activeConversationId!)) && (
            <div className="typing-indicator">
              {!isRoom && (
                <Avatar
                  size={26}
                  src={avatarUrl(activeUser?.avatar)}
                  style={{
                    background: "var(--color-primary)",
                    fontSize: 11,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
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

        {/* Aşağı in butonu */}
        {showScrollButton && (
          <div
            onClick={scrollToBottom}
            style={{
              position: "absolute",
              bottom: 90,
              left: "50%",
              transform: "translateX(-50%)",
              background: hasNewMessage ? "var(--color-primary)" : "#fff",
              color: hasNewMessage ? "#fff" : "var(--color-primary)",
              border: hasNewMessage
                ? "none"
                : "1px solid var(--color-primary-light)",
              padding: "8px 16px",
              borderRadius: 20,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 12px rgba(74,85,104,0.25)",
              fontSize: 13,
              fontWeight: 500,
              zIndex: 10,
            }}
          >
            {hasNewMessage ? "Yeni mesaj" : "Aşağı in"}
            <span style={{ fontSize: 16, lineHeight: 1 }}>↓</span>
          </div>
        )}

        {/* Mesaj yazma alanı — engel yoksa input, varsa uyarı */}
        {isBlocked ? (
          <div
            style={{
              padding: "18px 24px",
              borderTop: "1px solid #f0f0f0",
              background: "#fafafa",
              textAlign: "center",
              color: "#999",
              fontSize: 14,
            }}
          >
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

      {/* Kişi detay paneli (bireysel sohbet) */}
      {detailOpen && !isRoom && activeUser && (
        <UserDetailPanel
          user={activeUser}
          isOnline={isOnline}
          onClose={() => setDetailOpen(false)}
        />
      )}

      {/* Grup detay paneli */}
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

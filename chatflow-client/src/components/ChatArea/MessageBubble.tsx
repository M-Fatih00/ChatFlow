import { useState, useRef } from "react";
import { Avatar, Typography, Popover, Modal, Spin } from "antd";
import {
  MoreOutlined,
  DeleteOutlined,
  SmileOutlined,
  PaperClipOutlined,
  CheckOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import agent from "../../api/requests";
import type { IUser } from "../../models/IUser";
import type { IMessage } from "../../models/IMessage";
import { signalRService } from "../../api/signalRService";
import { avatarUrl } from "../../utils/avatarUrl";

const { Text } = Typography;

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// Mesajı gören/ileten üye tipi (kimler gördü modalı)
interface SeenUser {
  userId: string;
  fullName: string;
  avatar?: string;
  isRead: boolean;
  isDelivered: boolean;
}

// Mesaj içindeki eşleşen kelimeyi sarı vurgulayan yardımcı bileşen
function HighlightedText({
  text,
  query,
  baseColor,
  isActive,
}: {
  text: string;
  query: string;
  baseColor: string;
  isActive: boolean;
}) {
  if (!query.trim()) {
    return <span style={{ color: baseColor }}>{text}</span>;
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <span style={{ color: baseColor }}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            style={{
              background: isActive ? "#faad14" : "#fff3cd",
              color: "#000",
              padding: "0 2px",
              borderRadius: 3,
              fontWeight: isActive ? 700 : 400,
            }}
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </span>
  );
}

function EmojiText({ text, color }: { text: string; color: string }) {
  const parts = text.split(
    /(\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic})*\uFE0F?)/gu,
  );
  return (
    <span style={{ color }}>
      {parts.map((part, i) =>
        /\p{Extended_Pictographic}/u.test(part) ? (
          <span
            key={i}
            style={{
              fontSize: "1.4em",
              verticalAlign: "middle",
              lineHeight: 1,
            }}
          >
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </span>
  );
}

interface MessageBubbleProps {
  msg: IMessage;
  currentUser: IUser | null;
  isRoom: boolean;
  activeUser: IUser | null;
  searchQuery: string;
  matchingMessageIds: number[];
  activeMatchId: number | null;
}

export default function MessageBubble({
  msg,
  currentUser,
  isRoom,
  activeUser,
  searchQuery,
  matchingMessageIds,
  activeMatchId,
}: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false); // mobil long-press menüsü
  const [emojiOpen, setEmojiOpen] = useState(false); // masaüstü emoji popover
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "Kimler gördü" modalı (grup)
  const [seenModalOpen, setSeenModalOpen] = useState(false);
  const [seenList, setSeenList] = useState<SeenUser[]>([]);
  const [seenLoading, setSeenLoading] = useState(false);

  const isMine = msg.senderId === currentUser?.id;

  const time = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const displayName = isMine
    ? currentUser?.fullName
    : isRoom
      ? (msg.senderName ?? "Bilinmiyor")
      : activeUser?.fullName;

  const displayAvatar = isMine
    ? currentUser?.avatar
    : isRoom
      ? msg.senderAvatar
      : activeUser?.avatar;

  const isMatch =
    searchQuery.trim() !== "" && matchingMessageIds.includes(msg.id);
  const isActiveMatch = msg.id === activeMatchId;

  const bubbleTextColor = msg.isDeleted
    ? isMine
      ? "#999"
      : "rgba(255,255,255,0.6)"
    : isMine
      ? "#2d2d2d"
      : "#fff";

  const hasReactions = !!msg.reactions && msg.reactions.length > 0;

  // ---- Handler ----
  const startLongPress = () => {
    if (msg.isDeleted) return;
    longPressTimer.current = setTimeout(() => setMenuOpen(true), 450);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  // Emoji seç: reaksiyonu gönder + açık menüleri kapat
  const handleReact = (emoji: string) => {
    signalRService.toggleReaction(msg.id, emoji);
    setEmojiOpen(false);
    setMenuOpen(false);
  };

  // Silme onayı (masaüstü + mobil ortak)
  const confirmDelete = () => {
    Modal.confirm({
      title: "Mesajı sil",
      content: "Bu mesajı silmek istediğinize emin misiniz?",
      okText: "Sil",
      okType: "danger",
      cancelText: "İptal",
      maskClosable: true, // maskeye tıklayınca da kapansın
      onOk: () => signalRService.deleteMessage(msg.id),
    });
  };

  // Grup tikine tıklayınca: kimler gördü/iletildi listesini getir
  const openSeenModal = async () => {
    setSeenModalOpen(true);
    setSeenLoading(true);
    try {
      const data = await agent.Message.getMessageStatuses(msg.id);
      setSeenList(data);
    } catch {
      setSeenList([]);
    } finally {
      setSeenLoading(false);
    }
  };

  const renderEmojiPicker = () => (
    <div style={{ display: "flex", gap: 8, padding: 4 }}>
      {REACTION_EMOJIS.map((emoji) => (
        <span
          key={emoji}
          style={{ fontSize: 18, cursor: "pointer" }}
          onClick={() => handleReact(emoji)}
        >
          {emoji}
        </span>
      ))}
    </div>
  );

  const renderLongPressMenu = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 10, padding: "2px 4px" }}>
        {REACTION_EMOJIS.map((emoji) => (
          <span
            key={emoji}
            style={{ fontSize: 22, cursor: "pointer" }}
            onClick={() => handleReact(emoji)}
          >
            {emoji}
          </span>
        ))}
      </div>

      {/* Grup + kendi mesajım: kimler gördü */}
      {isMine && !msg.isDeleted && isRoom && (
        <div
          onClick={() => {
            setMenuOpen(false);
            openSeenModal();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 6px",
            color: "var(--color-primary)",
            cursor: "pointer",
            borderTop: "1px solid #f0f0f0",
            fontSize: 14,
          }}
        >
          <InfoCircleOutlined /> Okundu Bilgisi
        </div>
      )}

      {isMine && !msg.isDeleted && (
        <div
          onClick={() => {
            setMenuOpen(false);
            confirmDelete();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 6px",
            color: "#ff4d4f",
            cursor: "pointer",
            borderTop: "1px solid #f0f0f0",
            fontSize: 14,
          }}
        >
          <DeleteOutlined /> Sil
        </div>
      )}
    </div>
  );

  const renderReactions = () => {
    if (!msg.reactions || msg.reactions.length === 0) return null;

    const grouped = msg.reactions.reduce<Record<string, string[]>>((acc, r) => {
      acc[r.emoji] = acc[r.emoji] ? [...acc[r.emoji], r.userId] : [r.userId];
      return acc;
    }, {});

    return (
      <div
        style={{
          position: "absolute",
          bottom: -18,
          [isMine ? "left" : "right"]: 8,
          display: "flex",
          gap: 2,
          background: "#fff",
          borderRadius: 12,
          padding: "2px 5px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          border: "1px solid #f0f0f0",
        }}
      >
        {Object.entries(grouped).map(([emoji, userIds]) => (
          <span
            key={emoji}
            onClick={() => handleReact(emoji)}
            title={`${userIds.length} kişi`}
            style={{ fontSize: 14, cursor: "pointer" }}
          >
            {emoji}
          </span>
        ))}
      </div>
    );
  };

  // Dosya / resim eki
  const renderAttachment = () => {
    if (msg.isDeleted || !msg.attachmentUrl) return null;

    return (
      <div style={{ marginBottom: msg.content ? 6 : 0 }}>
        {msg.attachmentType === "image" ? (
          <img
            src={avatarUrl(msg.attachmentUrl)}
            alt="attachment"
            style={{
              maxWidth: 220,
              maxHeight: 220,
              borderRadius: 8,
              cursor: "pointer",
              display: "block",
            }}
            onClick={() => window.open(avatarUrl(msg.attachmentUrl), "_blank")}
          />
        ) : (
          <a
            href={avatarUrl(msg.attachmentUrl)?.replace(
              "/raw/upload/",
              "/raw/upload/fl_attachment/",
            )}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: isMine
                ? "rgba(0,0,0,0.05)"
                : "rgba(255,255,255,0.15)",
              borderRadius: 8,
              color: bubbleTextColor,
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            <PaperClipOutlined />
            <span>Dosyayı indir</span>
          </a>
        )}
      </div>
    );
  };

  // Kimler gördü / iletildi listesi (tek bölüm)
  const renderSeenSection = (
    title: React.ReactNode,
    users: SeenUser[],
    emptyText: string,
  ) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 8 }}>{title}</div>
      {users.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {emptyText}
        </Text>
      ) : (
        users.map((u) => (
          <div
            key={u.userId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 0",
            }}
          >
            <Avatar
              src={avatarUrl(u.avatar)}
              style={{ background: "var(--color-primary)" }}
            >
              {u.fullName.charAt(0).toUpperCase()}
            </Avatar>
            <Text style={{ fontSize: 14 }}>{u.fullName}</Text>
          </div>
        ))
      )}
    </div>
  );

  // Mesaj sadece emoji(ler)den mi oluşuyor? (WhatsApp gibi büyük göster)
  const isOnlyEmojis = (text: string) => {
    if (!text.trim()) return false;
    // emoji + boşluk + varyasyon seçici dışında karakter var mı?
    const stripped = text.replace(
      /[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F\s]/gu,
      "",
    );
    return stripped.length === 0;
  };

  const onlyEmoji =
    !msg.isDeleted && !!msg.content && isOnlyEmojis(msg.content);
  // Kaç emoji? (1-3 arası daha büyük, fazlaysa biraz küçük)
  const emojiCount = onlyEmoji
    ? [...(msg.content.match(/\p{Extended_Pictographic}/gu) ?? [])].length
    : 0;
  const emojiFontSize = emojiCount > 0 && emojiCount <= 3 ? 28 : 22;

  return (
    <div
      id={`message-${msg.id}`}
      style={{
        display: "flex",
        justifyContent: isMine ? "flex-end" : "flex-start",
        marginBottom: 24,
      }}
    >
      {/* Mobil menü açıkken: ekranın herhangi bir yerine dokununca kapat */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          onTouchStart={() => setMenuOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 1000 }}
        />
      )}

      <div
        className="bubble-row"
        style={{
          display: "flex",
          flexDirection: isMine ? "row-reverse" : "row",
          alignItems: "flex-end",
          gap: 8,
          maxWidth: "55%",
        }}
      >
        {!msg.isDeleted && (
          <Popover
            open={emojiOpen}
            onOpenChange={setEmojiOpen}
            content={renderEmojiPicker()}
            trigger="click"
            placement={isMine ? "left" : "right"}
          >
            <SmileOutlined
              className="bubble-side-action"
              style={{
                color: "#ccc",
                fontSize: 14,
                cursor: "pointer",
                alignSelf: "flex-start",
                marginTop: 8,
              }}
            />
          </Popover>
        )}

        {isMine && !msg.isDeleted ? (
          <Popover
            trigger="click"
            placement="topRight"
            align={{ offset: [0, -6] }}
            content={renderLongPressMenu()}
          >
            <MoreOutlined
              className="bubble-side-action"
              style={{
                color: "#ccc",
                fontSize: 14,
                cursor: "pointer",
                alignSelf: "flex-start",
                marginTop: 8,
              }}
            />
          </Popover>
        ) : (
          <MoreOutlined
            className="bubble-side-action"
            style={{
              color: "#ccc",
              fontSize: 14,
              cursor: "pointer",
              alignSelf: "flex-start",
              marginTop: 8,
              visibility: isMine ? "visible" : "hidden",
            }}
          />
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: isMine ? "flex-end" : "flex-start",
          }}
        >
          <Popover
            open={menuOpen}
            onOpenChange={setMenuOpen}
            trigger={[]}
            placement="top"
            content={renderLongPressMenu()}
          >
            <div
              className="bubble-clickable"
              style={{ position: "relative", zIndex: menuOpen ? 1001 : "auto" }}
              onTouchStart={startLongPress}
              onTouchEnd={cancelLongPress}
              onTouchMove={cancelLongPress}
              onContextMenu={(e) => e.preventDefault()}
            >
              <div
                className={
                  isMine ? "message-bubble-right" : "message-bubble-left"
                }
              >
                {renderAttachment()}

                {(msg.content || msg.isDeleted) && (
                  <Text
                    className="bubble-text"
                    style={{
                      fontSize: onlyEmoji ? emojiFontSize : 14,
                      lineHeight: onlyEmoji ? 1.2 : 1.5,
                      fontStyle: msg.isDeleted ? "italic" : "normal",
                    }}
                  >
                    {msg.isDeleted ? (
                      <span style={{ color: bubbleTextColor }}>
                        🚫 Bu mesaj silindi
                      </span>
                    ) : isMatch ? (
                      <HighlightedText
                        text={msg.content}
                        query={searchQuery}
                        baseColor={bubbleTextColor}
                        isActive={isActiveMatch}
                      />
                    ) : onlyEmoji ? (
                      <span style={{ color: bubbleTextColor }}>
                        {msg.content}
                      </span>
                    ) : (
                      <EmojiText text={msg.content} color={bubbleTextColor} />
                    )}
                  </Text>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 4,
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      color: isMine ? "#aaa" : "rgba(255,255,255,0.7)",
                    }}
                  >
                    ⏱ {time}
                  </Text>
                  {isMine &&
                    !msg.isDeleted &&
                    (isRoom ? (
                      // Grup tiki: tüm alıcılar okuduysa çift yeşil, değilse tek gri.
                      (() => {
                        const total = msg.totalRecipients ?? 0;
                        const read = msg.readCount ?? 0;
                        const allRead = total > 0 && read >= total;
                        return (
                          <Text
                            style={{
                              fontSize: 12,
                              color: allRead ? "var(--color-primary)" : "#aaa",
                              fontWeight: 600,
                            }}
                          >
                            {allRead ? "✓✓" : "✓"}
                          </Text>
                        );
                      })()
                    ) : (
                      // Bireysel tik (mevcut mantık)
                      <Text
                        style={{
                          fontSize: 12,
                          color: msg.isRead ? "var(--color-primary)" : "#aaa",
                          fontWeight: 600,
                        }}
                      >
                        {msg.isRead || msg.isDelivered ? "✓✓" : "✓"}
                      </Text>
                    ))}
                </div>
              </div>
              {renderReactions()}
            </div>
          </Popover>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: hasReactions ? 22 : 6,
              flexDirection: isMine ? "row-reverse" : "row",
            }}
          >
            <Avatar
              size={26}
              src={avatarUrl(displayAvatar)}
              style={{
                background: "var(--color-primary)",
                fontSize: 11,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {displayName?.charAt(0)}
            </Avatar>
            <Text style={{ fontSize: 11, color: "#aaa" }}>{displayName}</Text>
          </div>
        </div>
      </div>

      {/* Kimler gördü modalı (sadece grup, kendi mesajım) */}
      <Modal
        title="Mesaj bilgisi"
        open={seenModalOpen}
        onCancel={() => setSeenModalOpen(false)}
        footer={null}
      >
        {seenLoading ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <Spin />
          </div>
        ) : (
          renderSeenSection(
            <Text strong style={{ color: "var(--color-primary)" }}>
              <CheckOutlined />
              <CheckOutlined /> Okundu (
              {seenList.filter((u) => u.isRead).length})
            </Text>,
            seenList.filter((u) => u.isRead),
            "Henüz kimse görmedi",
          )
        )}
      </Modal>
    </div>
  );
}

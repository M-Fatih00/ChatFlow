import { Input, Button, message as antdMessage } from "antd";
import {
  SmileOutlined,
  PaperClipOutlined,
  SendOutlined,
  CloseOutlined,
  FileOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import "./MessageInput.css";
import { useState, useRef, useEffect } from "react";
import EmojiPicker, {
  EmojiStyle,
  type EmojiClickData,
} from "emoji-picker-react";
import { useAppSelector } from "../../store/store";
import { signalRService } from "../../api/signalRService";
import agent from "../../api/requests";
import { avatarUrl } from "../../utils/avatarUrl";
import "./MessageInput.css";

export default function MessageInput() {
  const [content, setContent] = useState("");
  const { activeConversationId, isRoom } = useAppSelector(
    (state) => state.chat,
  );
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // İki ayrı gizli file input: resim ve genel dosya
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Menü + emoji açık/kapalı
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Seçilen dosya (henüz gönderilmemiş)
  const [attachment, setAttachment] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  // Dışarı tıklayınca menü/emoji kapansın
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setAttachMenuOpen(false);
        setEmojiOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await agent.Message.uploadAttachment(formData);
      setAttachment({ url: res.url, type: res.type, name: res.name });
    } catch {
      antdMessage.error("Dosya yüklenemedi");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleEmojiClick = (data: EmojiClickData) => {
    setContent((prev) => prev + data.emoji);
  };

  const handleSend = async () => {
    if ((!content.trim() && !attachment) || !activeConversationId) return;

    await signalRService.sendMessage(
      content,
      isRoom ? undefined : activeConversationId,
      isRoom ? Number(activeConversationId) : undefined,
      attachment?.url,
      attachment?.type,
    );

    setContent("");
    setAttachment(null);
    setEmojiOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend();
      return;
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      signalRService.startTyping(
        isRoom ? undefined : (activeConversationId ?? undefined),
        isRoom ? Number(activeConversationId) : undefined,
      );
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      signalRService.stopTyping(
        isRoom ? undefined : (activeConversationId ?? undefined),
        isRoom ? Number(activeConversationId) : undefined,
      );
    }, 2000);
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      {/* Emoji picker (input üstünde) */}
      {emojiOpen && (
        <div className="emoji-picker-container">
          <div
            className="emoji-picker-close"
            onClick={() => setEmojiOpen(false)}
          >
            <CloseOutlined />
          </div>
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            emojiStyle={EmojiStyle.NATIVE}
            height={
              typeof window !== "undefined" && window.innerWidth <= 900
                ? 300
                : 380
            }
            width="100%"
            searchDisabled={false}
            skinTonesDisabled
            previewConfig={{ showPreview: false }}
            lazyLoadEmojis
          />
        </div>
      )}

      {/* Ataç menüsü (input üstünde, WhatsApp gibi) */}
      {attachMenuOpen && (
        <div className="attach-menu">
          <div
            className="attach-menu-item"
            onClick={() => {
              setAttachMenuOpen(false);
              imageInputRef.current?.click();
            }}
          >
            <div
              className="attach-menu-icon"
              style={{ background: "#e8f5e9", color: "var(--color-primary)" }}
            >
              <PictureOutlined />
            </div>
            <span>Resim</span>
          </div>

          <div
            className="attach-menu-item"
            onClick={() => {
              setAttachMenuOpen(false);
              fileInputRef.current?.click();
            }}
          >
            <div
              className="attach-menu-icon"
              style={{ background: "#e3f2fd", color: "#1976d2" }}
            >
              <FileOutlined />
            </div>
            <span>Dosya</span>
          </div>
        </div>
      )}

      {/* Seçilen dosya önizlemesi */}
      {attachment && (
        <div className="attachment-preview-row">
          <div className="attachment-preview">
            {attachment.type === "image" ? (
              <img
                src={avatarUrl(attachment.url)}
                alt="preview"
                className="attachment-preview-img"
              />
            ) : (
              <FileOutlined className="attachment-preview-file-icon" />
            )}
            <span className="attachment-preview-name">{attachment.name}</span>
            <CloseOutlined
              className="attachment-preview-close"
              onClick={() => setAttachment(null)}
            />
          </div>
        </div>
      )}

      <div className="message-input-wrapper">
        {/* Gizli file input'lar */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />

        <Input
          placeholder="Enter Message..."
          size="large"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setEmojiOpen(false);
            setAttachMenuOpen(false);
          }}
        />

        <SmileOutlined
          className="message-input-icon"
          onClick={() => {
            setEmojiOpen((v) => !v);
            setAttachMenuOpen(false);
          }}
          style={{ color: emojiOpen ? "var(--color-primary)" : undefined }}
        />

        <PaperClipOutlined
          className="message-input-icon"
          onClick={() => {
            setAttachMenuOpen((v) => !v);
            setEmojiOpen(false);
          }}
          style={{
            opacity: uploading ? 0.4 : 1,
            color: attachMenuOpen ? "var(--color-primary)" : undefined,
          }}
        />

        <Button
          type="primary"
          shape="circle"
          icon={<SendOutlined />}
          size="large"
          className="message-input-send-btn"
          onClick={handleSend}
        />
      </div>
    </div>
  );
}

import { Avatar, Typography, Input, Dropdown } from "antd";
import {
  SearchOutlined,
  PhoneOutlined,
  VideoCameraOutlined,
  MoreOutlined,
  TeamOutlined,
  CloseOutlined,
  UpOutlined,
  DownOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined,
  StopOutlined,
} from "@ant-design/icons";
import type { IUser } from "../../models/IUser";
import type { IRoom } from "../../models/IRoom";
import { avatarUrl } from "../../utils/avatarUrl";
import { formatLastSeen } from "../../utils/lastSeen";

const { Text } = Typography;

interface ChatHeaderProps {
  isRoom: boolean;
  activeUser: IUser | null;
  activeRoom: IRoom | null;
  isOnline: boolean;
  onBack: () => void;
  onOpenDetails: () => void;
  // engelleme
  isBlocked: boolean; // herhangi bir yönde engel var mı
  iBlocked: boolean; // ben mi engelledim (dropdown etiketi için)
  onToggleBlock: () => void;
  // arama
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  setMatchIndex: (v: number) => void;
  matchIndex: number;
  matchingMessageIds: number[];
  goToNextMatch: () => void;
  goToPrevMatch: () => void;
  closeSearch: () => void;
  // üye modalı
  openMembersModal: () => void;
}

export default function ChatHeader({
  isRoom,
  activeUser,
  activeRoom,
  isOnline,
  onBack,
  onOpenDetails,
  isBlocked,
  iBlocked,
  onToggleBlock,
  searchOpen,
  setSearchOpen,
  searchQuery,
  setSearchQuery,
  setMatchIndex,
  matchIndex,
  matchingMessageIds,
  goToNextMatch,
  goToPrevMatch,
  closeSearch,
  openMembersModal,
}: ChatHeaderProps) {
  const headerName = isRoom
    ? (activeRoom?.name ?? "...")
    : (activeUser?.fullName ?? "...");
  const headerInitial = isRoom
    ? (activeRoom?.name?.charAt(0).toUpperCase() ?? "#")
    : (activeUser?.fullName?.charAt(0) ?? "?");

  return (
    <>
      <div
        style={{
          padding: "14px 24px",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#fff",
          gap: 16,
        }}
      >
        {/* Sol: avatar + isim + durum */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 0,
            flex: 1,
          }}
        >
          <ArrowLeftOutlined
            className="chat-back-btn"
            onClick={onBack}
            style={{ fontSize: 18, color: "#aaa", cursor: "pointer" }}
          />
          {isRoom ? (
            <Avatar
              size={44}
              src={avatarUrl(activeRoom?.avatar)}
              onClick={onOpenDetails}
              style={{
                background: "var(--color-primary-light)",
                color: "var(--color-primary)",
                fontSize: 18,
                fontWeight: 700,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {headerInitial}
            </Avatar>
          ) : (
            <Avatar
              size={44}
              src={avatarUrl(activeUser?.avatar)}
              onClick={onOpenDetails}
              style={{
                background: "var(--color-primary)",
                fontSize: 18,
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {headerInitial}
            </Avatar>
          )}

          {/* İsim (üst) + durum (alt) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              flex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minWidth: 0,
              }}
            >
              <Text
                strong
                style={{
                  fontSize: 15,
                  cursor: "pointer",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "block",
                  minWidth: 0,
                  flex: "0 1 auto",
                }}
                onClick={onOpenDetails}
              >
                {isRoom ? `#${headerName}` : headerName}
              </Text>
              {isRoom && (
                <TeamOutlined
                  style={{
                    color: "#aaa",
                    fontSize: 14,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                  onClick={openMembersModal}
                />
              )}
            </div>

            {/* Bireysel: çevrimiçi / son görülme (engel yoksa) */}
            {!isRoom && !isBlocked && (
              <Text
                style={{
                  fontSize: 12,
                  color: isOnline ? "var(--color-primary)" : "#aaa",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {isOnline ? "çevrimiçi" : formatLastSeen(activeUser?.lastSeen)}
              </Text>
            )}
          </div>
        </div>

        {/* Orta: arama inputu — masaüstü (ortada, dar) */}
        {searchOpen && (
          <div
            className="header-search-desktop"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flex: 1,
              maxWidth: 360,
              margin: "0 auto",
            }}
          >
            <Input
              autoFocus
              size="small"
              placeholder="Mesajlarda ara..."
              prefix={<SearchOutlined style={{ color: "#aaa" }} />}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setMatchIndex(0);
              }}
              onPressEnter={goToNextMatch}
              style={{ borderRadius: 16 }}
            />
            {searchQuery.trim() && (
              <Text
                style={{ fontSize: 12, color: "#aaa", whiteSpace: "nowrap" }}
              >
                {matchingMessageIds.length > 0
                  ? `${matchIndex + 1}/${matchingMessageIds.length}`
                  : "0/0"}
              </Text>
            )}
            <UpOutlined
              style={{ fontSize: 12, color: "#aaa", cursor: "pointer" }}
              onClick={goToPrevMatch}
            />
            <DownOutlined
              style={{ fontSize: 12, color: "#aaa", cursor: "pointer" }}
              onClick={goToNextMatch}
            />
            <CloseOutlined
              style={{ fontSize: 14, color: "#aaa", cursor: "pointer" }}
              onClick={closeSearch}
            />
          </div>
        )}

        {/* Sağ: ikonlar */}
        <div
          style={{
            display: "flex",
            gap: 24,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          {!searchOpen && (
            <SearchOutlined
              style={{ fontSize: 18, color: "#aaa", cursor: "pointer" }}
              onClick={() => setSearchOpen(true)}
            />
          )}

          {/* Masaüstü: ikonlar tek tek (sadece bireysel) */}
          {!isRoom && (
            <>
              <PhoneOutlined
                className="header-desktop-icon"
                style={{ fontSize: 18, color: "#aaa", cursor: "pointer" }}
              />
              <VideoCameraOutlined
                className="header-desktop-icon"
                style={{ fontSize: 18, color: "#aaa", cursor: "pointer" }}
              />
              {/* Masaüstü: engelle/kaldır dropdown (bireysel) */}
              <Dropdown
                trigger={["click"]}
                placement="bottomRight"
                menu={{
                  items: [
                    {
                      key: "block",
                      label: iBlocked ? "Engeli Kaldır" : "Engelle",
                      icon: <StopOutlined />,
                      danger: !iBlocked,
                      onClick: onToggleBlock,
                    },
                  ],
                }}
              >
                <MoreOutlined
                  className="header-desktop-icon"
                  style={{ fontSize: 18, color: "#aaa", cursor: "pointer" }}
                />
              </Dropdown>
            </>
          )}

          {/* Mobil: tek dropdown */}
          <Dropdown
            trigger={["click"]}
            classNames={{ root: "header-mobile-dropdown" }}
            menu={{
              items: [
                {
                  key: "details",
                  label: isRoom ? "Grup detayları" : "Kişi detayları",
                  icon: <InfoCircleOutlined />,
                  onClick: onOpenDetails,
                },
                ...(!isRoom
                  ? [
                      {
                        key: "voice",
                        label: "Sesli arama",
                        icon: <PhoneOutlined />,
                      },
                      {
                        key: "video",
                        label: "Görüntülü arama",
                        icon: <VideoCameraOutlined />,
                      },
                      {
                        key: "block",
                        label: iBlocked ? "Engeli Kaldır" : "Engelle",
                        icon: <StopOutlined />,
                        danger: !iBlocked,
                        onClick: onToggleBlock,
                      },
                    ]
                  : []),
              ],
            }}
          >
            <MoreOutlined
              className="header-mobile-more"
              style={{ fontSize: 18, color: "#aaa", cursor: "pointer" }}
            />
          </Dropdown>
        </div>
      </div>

      {/* Mobil: arama header'ın altında tam genişlik */}
      {searchOpen && (
        <div className="header-search-mobile">
          <Input
            autoFocus
            placeholder="Mesajlarda ara..."
            prefix={<SearchOutlined style={{ color: "#aaa" }} />}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setMatchIndex(0);
            }}
            onPressEnter={goToNextMatch}
            style={{ borderRadius: 20, width: "100%" }}
            suffix={
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {searchQuery.trim() && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#aaa",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {matchingMessageIds.length > 0
                      ? `${matchIndex + 1}/${matchingMessageIds.length}`
                      : "0/0"}
                  </Text>
                )}
                <UpOutlined
                  style={{ fontSize: 13, color: "#aaa", cursor: "pointer" }}
                  onClick={goToPrevMatch}
                />
                <DownOutlined
                  style={{ fontSize: 13, color: "#aaa", cursor: "pointer" }}
                  onClick={goToNextMatch}
                />
              </div>
            }
          />
        </div>
      )}
    </>
  );
}
import { Avatar, Dropdown, Modal } from "antd";
import {
  UserOutlined,
  MessageOutlined,
  TeamOutlined,
  SettingOutlined,
  IdcardOutlined,
  LogoutOutlined,
  ContactsOutlined,
} from "@ant-design/icons";
import { useAppSelector, useAppDispatch } from "../../store/store";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ChatsPanel from "../../features/chats/ChatsPanel";
import ProfilePanel from "../../features/profile/ProfilePanel";
import GroupsPanel from "../../features/groups/GroupsPanel";
import ContactsPanel from "../../features/contacts/ContactsPanel";
import { logoutUser } from "../../features/auth/authSlice";
import { clearActiveConversation } from "../../features/chats/chatSlice";
import "./Sidebar.css";
import SettingsPanel from "../../features/settings/SettingsPanel";
import { avatarUrl } from "../../utils/avatarUrl";
import agent from "../../api/requests";

type PanelType = "chats" | "profile" | "groups" | "contacts" | "settings";

const navItems = [
  { key: "profile", icon: <UserOutlined /> },
  { key: "chats", icon: <MessageOutlined /> },
  { key: "groups", icon: <TeamOutlined /> },
  { key: "contacts", icon: <ContactsOutlined /> },
  { key: "settings", icon: <SettingOutlined /> },
];

export default function Sidebar() {
  const [activePanel, setActivePanel] = useState<PanelType>("chats");
  const [tooltipKey, setTooltipKey] = useState<string | null>(null);
  const { user } = useAppSelector((state) => state.auth);

  const [hasNewContact, setHasNewContact] = useState(false);
  const [hasNewChat, setHasNewChat] = useState(false);
  const [hasNewGroup, setHasNewGroup] = useState(false);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // Aktif paneli her zaman güncel tutan ref (event handler'larda okumak için)
  const activePanelRef = useRef(activePanel);
  activePanelRef.current = activePanel;

  useEffect(() => {
    if (!tooltipKey) return;
    const clear = () => setTooltipKey(null);
    window.addEventListener("click", clear);
    return () => window.removeEventListener("click", clear);
  }, [tooltipKey]);

  // Tooltip 3 saniye sonra otomatik kapansın
  useEffect(() => {
    if (!tooltipKey) return;
    const timer = setTimeout(() => setTooltipKey(null), 3000);
    return () => clearTimeout(timer);
  }, [tooltipKey]);

  const panelLabels: Record<string, string> = {
    profile: "Profile",
    chats: "Chats",
    groups: "Groups",
    contacts: "Contacts",
    settings: "Settings",
  };

  const changePanel = (key: PanelType) => {
    setActivePanel(key);
    if (key === "contacts") setHasNewContact(false);
    if (key === "chats") setHasNewChat(false);
    if (key === "groups") setHasNewGroup(false);
    // Panele geçince aktif sohbeti her zaman temizle (unread doğru çalışsın)
    dispatch(clearActiveConversation());
    if (window.innerWidth > 900) {
      navigate("/");
    }
  };

  // Çıkış onayı
  const confirmLogout = () => {
    Modal.confirm({
      title: "Çıkış Yap",
      content: "Çıkış yapmak istediğinize emin misiniz?",
      okText: "Çıkış Yap",
      okType: "danger",
      cancelText: "İptal",
      onOk: () => dispatch(logoutUser()),
    });
  };

  // Contacts noktası: bekleyen arkadaşlık isteği var mı?
  useEffect(() => {
    const check = () => {
      agent.Friendship.getRequests()
        .then((reqs: unknown[]) => setHasNewContact(reqs.length > 0))
        .catch(() => {});
    };
    check();
    window.addEventListener("friendRequestReceived", check);
    return () => window.removeEventListener("friendRequestReceived", check);
  }, []);

  // Chats / Groups noktası: yeni mesaj gelince yak (o panelde değilsem)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { isRoom?: boolean }
        | undefined;
      const isRoomMsg = detail?.isRoom === true;

      if (isRoomMsg) {
        if (activePanelRef.current !== "groups") setHasNewGroup(true);
      } else {
        if (activePanelRef.current !== "chats") setHasNewChat(true);
      }
    };
    window.addEventListener("messageReceived", handler);
    return () => window.removeEventListener("messageReceived", handler);
  }, []);

  const dotFor = (key: string) => {
    if (key === "contacts") return hasNewContact;
    if (key === "chats") return hasNewChat;
    if (key === "groups") return hasNewGroup;
    return false;
  };

  return (
    <div className="sidebar-wrapper">
      {(() => {
        // Masaüstü avatar menüsü (Profile + Settings + Log out)
        const desktopAvatarDropdown = (
          <Dropdown
            menu={{
              items: [
                {
                  key: "profile",
                  label: "Profile",
                  icon: <IdcardOutlined />,
                  onClick: () => changePanel("profile"),
                },
                {
                  key: "settings",
                  label: "Settings",
                  icon: <SettingOutlined />,
                  onClick: () => changePanel("settings"),
                },
                { type: "divider" },
                {
                  key: "logout",
                  label: "Log out",
                  icon: <LogoutOutlined />,
                  onClick: confirmLogout,
                },
              ],
            }}
            placement="topRight"
            trigger={["click"]}
          >
            <Avatar
              src={avatarUrl(user?.avatar)}
              className="icon-bar-avatar"
              style={{
                background: "var(--color-primary)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {user?.fullName?.charAt(0).toUpperCase() ?? "U"}
            </Avatar>
          </Dropdown>
        );

        // Mobil avatar menüsü (Log out YOK — Settings içine taşındı)
        const mobileAvatarDropdown = (
          <Dropdown
            menu={{
              items: [
                {
                  key: "profile",
                  label: "Profile",
                  icon: <IdcardOutlined />,
                  onClick: () => changePanel("profile"),
                },
                {
                  key: "settings",
                  label: "Settings",
                  icon: <SettingOutlined />,
                  onClick: () => changePanel("settings"),
                },
              ],
            }}
            placement="topRight"
            trigger={["click"]}
          >
            <Avatar
              src={avatarUrl(user?.avatar)}
              className="icon-bar-avatar"
              style={{
                background: "var(--color-primary)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {user?.fullName?.charAt(0).toUpperCase() ?? "U"}
            </Avatar>
          </Dropdown>
        );

        return (
          <>
            {/* MASAÜSTÜ ikon bar */}
            <div className="icon-bar icon-bar-desktop">
              <div
                className="icon-bar-logo"
                onClick={() => changePanel("chats")}
              >
                <MessageOutlined />
              </div>

              <div className="icon-bar-middle">
                {navItems.map((item) => (
                  <div
                    key={item.key}
                    onClick={(e) => {
                      e.stopPropagation();
                      changePanel(item.key as PanelType);
                      setTooltipKey(item.key);
                    }}
                    className={`icon-btn ${activePanel === item.key ? "active" : ""}`}
                    style={{ position: "relative" }}
                  >
                    {tooltipKey === item.key && (
                      <span className="desktop-tooltip">
                        {panelLabels[item.key]}
                      </span>
                    )}
                    {item.icon}
                    {dotFor(item.key) && <span className="nav-dot" />}
                  </div>
                ))}
              </div>

              {desktopAvatarDropdown}
            </div>

            {/* MOBİL ikon bar (Settings ikonu gizli, logout Settings içinde) */}
            <div className="icon-bar icon-bar-mobile">
              {navItems
                .filter((item) => item.key !== "settings")
                .map((item) => (
                  <div
                    key={item.key}
                    onClick={(e) => {
                      e.stopPropagation();
                      changePanel(item.key as PanelType);
                      setTooltipKey(item.key);
                    }}
                    className={`icon-btn ${activePanel === item.key ? "active" : ""}`}
                    style={{ position: "relative" }}
                  >
                    {tooltipKey === item.key && (
                      <span className="mobile-tooltip">
                        {panelLabels[item.key]}
                      </span>
                    )}
                    {item.icon}
                    {dotFor(item.key) && <span className="nav-dot" />}
                  </div>
                ))}
              {mobileAvatarDropdown}
            </div>
          </>
        );
      })()}

      {/* Dinamik panel */}
      {activePanel === "chats" && <ChatsPanel />}
      {activePanel === "profile" && <ProfilePanel />}
      {activePanel === "groups" && <GroupsPanel />}
      {activePanel === "contacts" && <ContactsPanel />}
      {activePanel === "settings" && <SettingsPanel />}
    </div>
  );
}
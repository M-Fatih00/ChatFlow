import { Avatar, Dropdown, Modal } from "antd";
import type { MenuProps } from "antd";
import {
  ContactsOutlined,
  IdcardOutlined,
  LogoutOutlined,
  MessageOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useEffect, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../store/store";
import ChatsPanel from "../../features/chats/ChatsPanel";
import ProfilePanel from "../../features/profile/ProfilePanel";
import GroupsPanel from "../../features/groups/GroupsPanel";
import ContactsPanel from "../../features/contacts/ContactsPanel";
import SettingsPanel from "../../features/settings/SettingsPanel";
import { logoutUser } from "../../features/auth/authSlice";
import { clearActiveConversation } from "../../features/chats/chatSlice";
import { avatarUrl } from "../../utils/avatarUrl";
import agent from "../../api/requests";
import "./Sidebar.css";

type PanelType = "chats" | "profile" | "groups" | "contacts" | "settings";

interface NavItem {
  key: PanelType;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { key: "profile", label: "Profil", icon: <UserOutlined /> },
  { key: "chats", label: "Sohbetler", icon: <MessageOutlined /> },
  { key: "groups", label: "Gruplar", icon: <TeamOutlined /> },
  { key: "contacts", label: "Kişiler", icon: <ContactsOutlined /> },
  { key: "settings", label: "Ayarlar", icon: <SettingOutlined /> },
];

const PANEL_COMPONENTS: Record<PanelType, ComponentType> = {
  chats: ChatsPanel,
  profile: ProfilePanel,
  groups: GroupsPanel,
  contacts: ContactsPanel,
  settings: SettingsPanel,
};

export default function Sidebar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);

  const [activePanel, setActivePanel] = useState<PanelType>("chats");
  const [visitedPanels, setVisitedPanels] = useState<PanelType[]>(["chats"]);
  const [mobileTooltip, setMobileTooltip] = useState<PanelType | null>(null);

  const [hasNewContact, setHasNewContact] = useState(false);
  const [hasNewChat, setHasNewChat] = useState(false);
  const [hasNewGroup, setHasNewGroup] = useState(false);

  const activePanelRef = useRef(activePanel);

  useEffect(() => {
    activePanelRef.current = activePanel;
  }, [activePanel]);

  useEffect(() => {
    if (!mobileTooltip) return;
    const timer = setTimeout(() => setMobileTooltip(null), 1500);
    return () => clearTimeout(timer);
  }, [mobileTooltip]);

  useEffect(() => {
    const check = () => {
      agent.Friendship.getRequests()
        .then((requests: unknown[]) => setHasNewContact(requests.length > 0))
        .catch(() => undefined);
    };
    check();
    window.addEventListener("friendRequestReceived", check);
    return () => window.removeEventListener("friendRequestReceived", check);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const isRoomMessage =
        (e as CustomEvent<{ isRoom?: boolean }>).detail?.isRoom === true;

      if (isRoomMessage) {
        if (activePanelRef.current !== "groups") setHasNewGroup(true);
      } else if (activePanelRef.current !== "chats") {
        setHasNewChat(true);
      }
    };
    window.addEventListener("messageReceived", handler);
    return () => window.removeEventListener("messageReceived", handler);
  }, []);

  const changePanel = (key: PanelType) => {
    setActivePanel(key);
    setVisitedPanels((prev) => (prev.includes(key) ? prev : [...prev, key]));
    if (key === "contacts") setHasNewContact(false);
    if (key === "chats") setHasNewChat(false);
    if (key === "groups") setHasNewGroup(false);
    dispatch(clearActiveConversation());
    if (window.innerWidth > 900) {
      navigate("/");
    }
  };

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

  const hasDot = (key: PanelType) =>
    (key === "contacts" && hasNewContact) ||
    (key === "chats" && hasNewChat) ||
    (key === "groups" && hasNewGroup);

  const avatarMenu = (withLogout: boolean): MenuProps["items"] => [
    {
      key: "profile",
      label: "Profil",
      icon: <IdcardOutlined />,
      onClick: () => changePanel("profile"),
    },
    {
      key: "settings",
      label: "Ayarlar",
      icon: <SettingOutlined />,
      onClick: () => changePanel("settings"),
    },
    ...(withLogout
      ? [
          { type: "divider" as const },
          {
            key: "logout",
            label: "Çıkış yap",
            icon: <LogoutOutlined />,
            danger: true,
            onClick: confirmLogout,
          },
        ]
      : []),
  ];

  const renderAvatar = (withLogout: boolean) => (
    <Dropdown
      menu={{ items: avatarMenu(withLogout) }}
      placement="topRight"
      trigger={["click"]}
    >
      <Avatar src={avatarUrl(user?.avatar)} className="icon-bar-avatar">
        {user?.fullName?.charAt(0).toUpperCase() ?? "U"}
      </Avatar>
    </Dropdown>
  );

  const renderNavButton = (item: NavItem, mobile: boolean) => (
    <button
      key={item.key}
      type="button"
      aria-label={item.label}
      className={`icon-btn ${activePanel === item.key ? "active" : ""}`}
      onClick={() => {
        changePanel(item.key);
        if (mobile) setMobileTooltip(item.key);
      }}
    >
      {item.icon}
      <span
        className={`nav-tooltip ${mobile && mobileTooltip === item.key ? "is-visible" : ""}`}
      >
        {item.label}
      </span>
      {hasDot(item.key) && <span className="nav-dot" />}
    </button>
  );

  return (
    <div className="sidebar-wrapper">
      <nav className="icon-bar icon-bar-desktop">
        <button
          type="button"
          className="icon-bar-logo"
          aria-label="Sohbetler"
          onClick={() => changePanel("chats")}
        >
          <MessageOutlined />
        </button>

        <div className="icon-bar-middle">
          {NAV_ITEMS.map((item) => renderNavButton(item, false))}
        </div>

        {renderAvatar(true)}
      </nav>

      <nav className="icon-bar icon-bar-mobile">
        {NAV_ITEMS.filter((item) => item.key !== "settings").map((item) =>
          renderNavButton(item, true),
        )}
        {renderAvatar(false)}
      </nav>

      {NAV_ITEMS.map(({ key }) => {
        if (!visitedPanels.includes(key)) return null;
        const Panel = PANEL_COMPONENTS[key];
        const isActive = activePanel === key;

        return (
          <div
            key={key}
            className={`sidebar-panel ${isActive ? "is-active anim anim-fade-up" : ""}`}
            aria-hidden={!isActive}
          >
            <Panel />
          </div>
        );
      })}
    </div>
  );
}
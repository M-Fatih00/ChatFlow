import { Avatar, Collapse, Image, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useAppSelector } from "../../store/store";
import { avatarUrl } from "../../utils/avatarUrl";
import { stagger } from "../../utils/animation";
import "./ProfilePanel.css";

const { Text } = Typography;

export default function ProfilePanel() {
  const { user } = useAppSelector((state) => state.auth);

  const joinedAt = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "-";

  const details = [
    { label: "Ad soyad", value: user?.fullName || "-" },
    { label: "Kullanıcı adı", value: user?.userName ? `@${user.userName}` : "-" },
    { label: "E-posta", value: user?.email || "-" },
    { label: "Üyelik tarihi", value: joinedAt },
  ];

  return (
    <div className="profile-panel">
      <div className="profile-panel-header anim anim-fade-down">
        <Text className="profile-panel-header-title">Profilim</Text>
      </div>

      <div className="profile-panel-avatar-section anim anim-scale" style={stagger(1)}>
        {user?.avatar ? (
          <Image
            src={avatarUrl(user.avatar)}
            width={96}
            height={96}
            className="profile-panel-avatar-image"
            preview={{ mask: null }}
            alt={user.fullName}
          />
        ) : (
          <Avatar size={96} className="profile-panel-avatar">
            {user?.fullName?.charAt(0).toUpperCase() ?? "U"}
          </Avatar>
        )}
        <Text className="profile-panel-name">{user?.fullName || "Kullanıcı"}</Text>
        {user?.userName && (
          <Text className="profile-panel-username">@{user.userName}</Text>
        )}
      </div>

      <div className="profile-panel-bio anim anim-fade-up" style={stagger(2)}>
        {user?.bio || "Henüz bir açıklama eklenmemiş."}
      </div>

      <Collapse
        defaultActiveKey={["about"]}
        ghost
        className="profile-panel-collapse anim anim-fade-up"
        style={stagger(3)}
        items={[
          {
            key: "about",
            label: (
              <div className="profile-panel-collapse-label">
                <UserOutlined className="profile-panel-collapse-icon" />
                <Text strong>Hakkında</Text>
              </div>
            ),
            children: (
              <div className="profile-panel-about-box">
                {details.map((item, index) => (
                  <div
                    key={item.label}
                    className="profile-panel-about-item anim anim-fade-up"
                    style={stagger(index + 4)}
                  >
                    <Text className="profile-panel-about-label">{item.label}</Text>
                    <Text className="profile-panel-about-value">{item.value}</Text>
                  </div>
                ))}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
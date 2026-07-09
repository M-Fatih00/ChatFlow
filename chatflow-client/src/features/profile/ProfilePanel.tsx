import { Avatar, Collapse, Image, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useAppSelector } from "../../store/store";
import { avatarUrl } from "../../utils/avatarUrl";
import "./ProfilePanel.css";

const { Text } = Typography;

export default function ProfilePanel() {
  const { user } = useAppSelector((state) => state.auth);

  return (
    <div className="profile-panel">
      {/* Header */}
      <div className="profile-panel-header">
        <Text className="profile-panel-header-title">My Profile</Text>
      </div>

      {/* Avatar + isim */}
      <div className="profile-panel-avatar-section">
        {user?.avatar ? (
          <Image
            src={avatarUrl(user.avatar)}
            width={88}
            height={88}
            style={{
              borderRadius: "50%",
              objectFit: "cover",
              cursor: "pointer",
            }}
            preview={{ mask: null }}
          />
        ) : (
          <Avatar
            size={88}
            style={{
              background: "var(--color-primary)",
              fontSize: 32,
              fontWeight: 600,
            }}
          >
            {user?.fullName?.charAt(0).toUpperCase() ?? "U"}
          </Avatar>
        )}
        <Text className="profile-panel-name">
          {user?.fullName ?? user?.userName ?? "Kullanıcı"}
        </Text>
      </div>

      {/* Bio */}
      <div className="profile-panel-bio">
        {user?.bio ?? "Henüz bir açıklama eklenmemiş."}
      </div>

      {/* About collapse */}
      <Collapse
        defaultActiveKey={["about"]}
        ghost
        className="profile-panel-collapse"
        items={[
          {
            key: "about",
            label: (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <UserOutlined style={{ color: "var(--color-primary)" }} />
                <Text strong>About</Text>
              </div>
            ),
            children: (
              <div className="profile-panel-about-box">
                {[
                  { label: "Name", value: user?.fullName ?? "-" },
                  { label: "Username", value: user?.userName ?? "-" },
                  { label: "Email", value: user?.email ?? "-" },
                  {
                    label: "Üyelik Tarihi",
                    value: user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString("tr-TR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })
                      : "-",
                  },
                ].map((item) => (
                  <div key={item.label} className="profile-panel-about-item">
                    <Text className="profile-panel-about-label">
                      {item.label}
                    </Text>
                    <Text className="profile-panel-about-value">
                      {item.value}
                    </Text>
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

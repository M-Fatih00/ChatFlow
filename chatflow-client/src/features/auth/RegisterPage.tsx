import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { useForm } from "react-hook-form";
import type { IRegisterForm } from "../../models/IRegisterForm";
import { registerUser } from "./authSlice";
import { Card, Input, Button, Typography } from "antd";
import { UserOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { Controller } from "react-hook-form";
import { Link } from "react-router-dom";

const { Title, Text } = Typography;

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { registerLoading } = useAppSelector((state) => state.auth);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<IRegisterForm>();

  const onSubmit = async (data: IRegisterForm) => {
    const result = await dispatch(registerUser(data));
    if (registerUser.fulfilled.match(result)) {
      navigate("/login");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-auth-bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div style={{ marginBottom: 12, textAlign: "center" }}>
        <Title level={3} style={{ margin: 0 }}>
          ChatFlow
        </Title>
      </div>

      <Title level={4} style={{ marginBottom: 2 }}>
        Sign up
      </Title>
      <Text type="secondary" style={{ marginBottom: 14, fontSize: 13 }}>
        Get your ChatFlow account now.
      </Text>

      <Card
        style={{ width: "100%", maxWidth: 420, borderRadius: 12 }}
        styles={{ body: { padding: "16px 20px" } }}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Full Name */}
          <div style={{ marginBottom: 10 }}>
            <Text strong style={{ fontSize: 13 }}>Full Name</Text>
            <Controller
              name="fullName"
              control={control}
              rules={{ required: "Ad soyad zorunlu" }}
              render={({ field }) => (
                <Input
                  {...field}
                  prefix={<UserOutlined />}
                  placeholder="Enter Full Name"
                  size="middle"
                  style={{ marginTop: 4 }}
                  status={errors.fullName ? "error" : ""}
                />
              )}
            />
            {errors.fullName && (
              <Text type="danger" style={{ fontSize: 12 }}>{errors.fullName.message}</Text>
            )}
          </div>

          {/* Email */}
          <div style={{ marginBottom: 10 }}>
            <Text strong style={{ fontSize: 13 }}>Email</Text>
            <Controller
              name="email"
              control={control}
              rules={{ required: "Email zorunlu" }}
              render={({ field }) => (
                <Input
                  {...field}
                  prefix={<MailOutlined />}
                  placeholder="Enter Email"
                  size="middle"
                  style={{ marginTop: 4 }}
                  status={errors.email ? "error" : ""}
                />
              )}
            />
            {errors.email && (
              <Text type="danger" style={{ fontSize: 12 }}>{errors.email.message}</Text>
            )}
          </div>

          {/* Username */}
          <div style={{ marginBottom: 10 }}>
            <Text strong style={{ fontSize: 13 }}>Username</Text>
            <Controller
              name="userName"
              control={control}
              rules={{ required: "Kullanıcı adı zorunlu" }}
              render={({ field }) => (
                <Input
                  {...field}
                  prefix={<UserOutlined />}
                  placeholder="Enter Username"
                  size="middle"
                  style={{ marginTop: 4 }}
                  status={errors.userName ? "error" : ""}
                />
              )}
            />
            {errors.userName && (
              <Text type="danger" style={{ fontSize: 12 }}>{errors.userName.message}</Text>
            )}
          </div>

          {/* Password + Confirm yan yana (masaüstü), alt alta (mobil) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div>
              <Text strong style={{ fontSize: 13 }}>Password</Text>
              <Controller
                name="password"
                control={control}
                rules={{
                  required: "Şifre zorunlu",
                  minLength: { value: 6, message: "En az 6 karakter" },
                }}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    prefix={<LockOutlined />}
                    placeholder="Password"
                    size="middle"
                    style={{ marginTop: 4 }}
                    status={errors.password ? "error" : ""}
                  />
                )}
              />
              {errors.password && (
                <Text type="danger" style={{ fontSize: 12 }}>{errors.password.message}</Text>
              )}
            </div>

            <div>
              <Text strong style={{ fontSize: 13 }}>Confirm</Text>
              <Controller
                name="confirmPassword"
                control={control}
                rules={{
                  required: "Zorunlu",
                  validate: (value, formValues) =>
                    value === formValues.password || "Eşleşmiyor",
                }}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    prefix={<LockOutlined />}
                    placeholder="Confirm"
                    size="middle"
                    style={{ marginTop: 4 }}
                    status={errors.confirmPassword ? "error" : ""}
                  />
                )}
              />
              {errors.confirmPassword && (
                <Text type="danger" style={{ fontSize: 12 }}>{errors.confirmPassword.message}</Text>
              )}
            </div>
          </div>

          <Button
            type="primary"
            htmlType="submit"
            size="middle"
            block
            loading={registerLoading}
            style={{
              background: "var(--color-primary)",
              borderColor: "var(--color-primary)",
              marginTop: 4,
            }}
          >
            Sign up
          </Button>

          <Text
            type="secondary"
            style={{
              display: "block",
              textAlign: "center",
              marginTop: 10,
              fontSize: 11,
            }}
          >
            By registering you agree to the ChatFlow{" "}
            <a href="#" style={{ color: "var(--color-primary)" }}>
              Terms of Use
            </a>
          </Text>
        </form>
      </Card>

      <div style={{ marginTop: 14, textAlign: "center" }}>
        <Text type="secondary" style={{ fontSize: 13 }}>Already have an account? </Text>
        <Link to="/login" style={{ color: "var(--color-primary)", fontSize: 13 }}>
          Signin
        </Link>
      </div>

      <Text type="secondary" style={{ marginTop: 10, fontSize: 11 }}>
        © 2024 ChatFlow. Crafted with ❤️
      </Text>
    </div>
  );
}
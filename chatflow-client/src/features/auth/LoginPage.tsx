import { Input, Button, Checkbox, Card, Typography } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useForm, Controller } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { loginUser } from "./authSlice";
import type { ILoginForm } from "../../models/ILoginForm";
import { useState } from "react";

const { Title, Text } = Typography;

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loginLoading } = useAppSelector((state) => state.auth);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ILoginForm>({
    defaultValues: { rememberMe: false },
  });

  const onSubmit = async (data: ILoginForm) => {
    setServerError(null);
    const trimmedData = { ...data, userName: data.userName.trim() };
    const result = await dispatch(loginUser(trimmedData));
    if (loginUser.fulfilled.match(result)) {
      navigate("/");
    } else {
      setServerError("Kullanıcı adı veya şifre hatalı");
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
        padding: "20px",
      }}
    >
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <Title level={3} style={{ margin: 0 }}>
          ChatFlow
        </Title>
      </div>

      <Title level={3} style={{ marginBottom: 4 }}>
        Sign in
      </Title>
      <Text type="secondary" style={{ marginBottom: 24 }}>
        Sign in to continue to ChatFlow.
      </Text>

      <Card style={{ width: "100%", maxWidth: 420, borderRadius: 12 }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Username</Text>
            <Controller
              name="userName"
              control={control}
              rules={{ required: "Kullanıcı adı zorunlu" }}
              render={({ field }) => (
                <Input
                  {...field}
                  prefix={<UserOutlined />}
                  placeholder="Enter Username"
                  size="large"
                  style={{ marginTop: 6 }}
                  status={errors.userName ? "error" : ""}
                />
              )}
            />
            {errors.userName && (
              <Text type="danger">{errors.userName.message}</Text>
            )}
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Text strong>Password</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Forgot password?
              </Text>
            </div>
            <Controller
              name="password"
              control={control}
              rules={{ required: "Şifre zorunlu" }}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  prefix={<LockOutlined />}
                  placeholder="Enter Password"
                  size="large"
                  style={{ marginTop: 6 }}
                  status={errors.password ? "error" : ""}
                />
              )}
            />
            {errors.password && (
              <Text type="danger">{errors.password.message}</Text>
            )}
          </div>

          <Controller
            name="rememberMe"
            control={control}
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                style={{ marginBottom: 16 }}
              >
                Remember me
              </Checkbox>
            )}
          />

          {serverError && (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 14px",
                background: "#fff2f0",
                border: "1px solid #ffccc7",
                borderRadius: 8,
              }}
            >
              <Text type="danger" style={{ fontSize: 13 }}>
                {serverError}
              </Text>
            </div>
          )}

          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={loginLoading}
            style={{
              background: "var(--color-primary)",
              borderColor: "var(--color-primary)",
            }}
          >
            Sign in
          </Button>
        </form>
      </Card>

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <Text type="secondary">Don't have an account? </Text>
        <Link to="/register" style={{ color: "var(--color-primary)" }}>
          Signup now
        </Link>
      </div>

      <Text type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
        © 2024 ChatFlow. Crafted with ❤️
      </Text>
    </div>
  );
}

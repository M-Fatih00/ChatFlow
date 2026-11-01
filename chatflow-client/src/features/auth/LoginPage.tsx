import { useState, type CSSProperties } from "react";
import { Alert, Button, Card, Checkbox, Input, Typography } from "antd";
import { LockOutlined, MessageOutlined, UserOutlined } from "@ant-design/icons";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { loginUser } from "./authSlice";
import type { ILoginForm } from "../../models/ILoginForm";

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
    defaultValues: { userName: "", password: "", rememberMe: false },
  });

  const onSubmit = async (data: ILoginForm) => {
    setServerError(null);
    const result = await dispatch(
      loginUser({ ...data, userName: data.userName.trim() }),
    );

    if (loginUser.fulfilled.match(result)) {
      navigate("/", { replace: true });
    } else {
      setServerError(result.payload ?? "Kullanıcı adı veya şifre hatalı.");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.brand} className="anim anim-fade-down">
        <div style={styles.logo}>
          <MessageOutlined style={{ fontSize: 26, color: "#fff" }} />
        </div>
        <Title level={3} style={{ margin: "12px 0 4px" }}>
          ChatFlow'a hoş geldin
        </Title>
        <Text type="secondary">Devam etmek için giriş yap.</Text>
      </div>

      <Card
        className="anim anim-fade-up"
        style={{ ...styles.card, animationDelay: "80ms" }}
        styles={{ body: { padding: 28 } }}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={styles.field}>
            <label htmlFor="userName">
              <Text strong>Kullanıcı adı</Text>
            </label>
            <Controller
              name="userName"
              control={control}
              rules={{ required: "Kullanıcı adı zorunlu" }}
              render={({ field }) => (
                <Input
                  {...field}
                  id="userName"
                  prefix={<UserOutlined />}
                  placeholder="kullaniciadi"
                  size="large"
                  autoComplete="username"
                  maxLength={64}
                  style={styles.input}
                  status={errors.userName ? "error" : ""}
                />
              )}
            />
            {errors.userName && (
              <Text type="danger" style={styles.error}>
                {errors.userName.message}
              </Text>
            )}
          </div>

          <div style={styles.field}>
            <label htmlFor="password">
              <Text strong>Şifre</Text>
            </label>
            <Controller
              name="password"
              control={control}
              rules={{ required: "Şifre zorunlu" }}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  id="password"
                  prefix={<LockOutlined />}
                  placeholder="••••••••"
                  size="large"
                  autoComplete="current-password"
                  maxLength={128}
                  style={styles.input}
                  status={errors.password ? "error" : ""}
                />
              )}
            />
            {errors.password && (
              <Text type="danger" style={styles.error}>
                {errors.password.message}
              </Text>
            )}
          </div>

          <Controller
            name="rememberMe"
            control={control}
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                style={{ marginBottom: 20 }}
              >
                Beni hatırla
              </Checkbox>
            )}
          />

          {serverError && (
            <Alert
              type="error"
              message={serverError}
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={loginLoading}
            style={styles.submit}
          >
            Giriş yap
          </Button>
        </form>
      </Card>

      <div style={{ marginTop: 24 }}>
        <Text type="secondary">Hesabın yok mu? </Text>
        <Link to="/register" style={styles.link}>
          Hemen kaydol
        </Link>
      </div>

      <Text type="secondary" style={styles.footer}>
        © {new Date().getFullYear()} ChatFlow
      </Text>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background: "var(--color-auth-bg)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  brand: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    marginBottom: 24,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    background: "var(--color-primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.06)",
  },
  field: { marginBottom: 16 },
  input: { marginTop: 6 },
  error: { display: "block", marginTop: 4, fontSize: 12 },
  submit: {
    background: "var(--color-primary)",
    borderColor: "var(--color-primary)",
    height: 46,
    fontWeight: 600,
  },
  link: { color: "var(--color-primary)", fontWeight: 600 },
  footer: { marginTop: 16, fontSize: 12 },
};

import { useState, type CSSProperties } from "react";
import { Alert, Button, Card, Input, Typography } from "antd";
import {
  LockOutlined,
  MailOutlined,
  MessageOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../../store/store";
import { registerUser } from "./authSlice";
import type { IRegisterForm } from "../../models/IRegisterForm";

const { Title, Text } = Typography;

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { registerLoading } = useAppSelector((state) => state.auth);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<IRegisterForm>({
    defaultValues: {
      fullName: "",
      email: "",
      userName: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: IRegisterForm) => {
    setServerError(null);
    const result = await dispatch(
      registerUser({
        ...data,
        fullName: data.fullName.trim(),
        email: data.email.trim(),
        userName: data.userName.trim(),
      }),
    );

    if (registerUser.fulfilled.match(result)) {
      toast.success(result.payload);
      navigate("/login", { replace: true });
    } else {
      setServerError(result.payload ?? "Kayıt başarısız oldu.");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.brand} className="anim anim-fade-down">
        <div style={styles.logo}>
          <MessageOutlined style={{ fontSize: 26, color: "#fff" }} />
        </div>
        <Title level={3} style={{ margin: "12px 0 4px" }}>
          Hesap oluştur
        </Title>
        <Text type="secondary">Birkaç saniyede ChatFlow'a katıl.</Text>
      </div>

      <Card
        className="anim anim-fade-up"
        style={{ ...styles.card, animationDelay: "80ms" }}
        styles={{ body: { padding: 28 } }}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={styles.field}>
            <label htmlFor="fullName">
              <Text strong>Ad soyad</Text>
            </label>
            <Controller
              name="fullName"
              control={control}
              rules={{
                required: "Ad soyad zorunlu",
                minLength: { value: 2, message: "En az 2 karakter" },
                maxLength: { value: 60, message: "En fazla 60 karakter" },
              }}
              render={({ field }) => (
                <Input
                  {...field}
                  id="fullName"
                  prefix={<UserOutlined />}
                  placeholder="Adınız Soyadınız"
                  size="large"
                  autoComplete="name"
                  maxLength={60}
                  style={styles.input}
                  status={errors.fullName ? "error" : ""}
                />
              )}
            />
            {errors.fullName && (
              <Text type="danger" style={styles.error}>
                {errors.fullName.message}
              </Text>
            )}
          </div>

          <div style={styles.field}>
            <label htmlFor="email">
              <Text strong>E-posta</Text>
            </label>
            <Controller
              name="email"
              control={control}
              rules={{
                required: "E-posta zorunlu",
                pattern: {
                  value: EMAIL_PATTERN,
                  message: "Geçerli bir e-posta girin",
                },
              }}
              render={({ field }) => (
                <Input
                  {...field}
                  id="email"
                  type="email"
                  prefix={<MailOutlined />}
                  placeholder="ornek@mail.com"
                  size="large"
                  autoComplete="email"
                  maxLength={254}
                  style={styles.input}
                  status={errors.email ? "error" : ""}
                />
              )}
            />
            {errors.email && (
              <Text type="danger" style={styles.error}>
                {errors.email.message}
              </Text>
            )}
          </div>

          <div style={styles.field}>
            <label htmlFor="userName">
              <Text strong>Kullanıcı adı</Text>
            </label>
            <Controller
              name="userName"
              control={control}
              rules={{
                required: "Kullanıcı adı zorunlu",
                minLength: { value: 3, message: "En az 3 karakter" },
                maxLength: { value: 30, message: "En fazla 30 karakter" },
                pattern: {
                  value: USERNAME_PATTERN,
                  message: "Yalnızca harf, rakam, nokta, alt çizgi ve tire",
                },
              }}
              render={({ field }) => (
                <Input
                  {...field}
                  id="userName"
                  prefix={<UserOutlined />}
                  placeholder="kullaniciadi"
                  size="large"
                  autoComplete="username"
                  maxLength={30}
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

          <div style={styles.passwordGrid}>
            <div>
              <label htmlFor="password">
                <Text strong>Şifre</Text>
              </label>
              <Controller
                name="password"
                control={control}
                rules={{
                  required: "Şifre zorunlu",
                  minLength: { value: 8, message: "En az 8 karakter" },
                  validate: (value) =>
                    (/[a-z]/.test(value) && /\d/.test(value)) ||
                    "Küçük harf ve rakam içermeli",
                }}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    id="password"
                    prefix={<LockOutlined />}
                    placeholder="Şifre"
                    size="large"
                    autoComplete="new-password"
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

            <div>
              <label htmlFor="confirmPassword">
                <Text strong>Şifre tekrar</Text>
              </label>
              <Controller
                name="confirmPassword"
                control={control}
                rules={{
                  required: "Şifre tekrarı zorunlu",
                  validate: (value, formValues) =>
                    value === formValues.password || "Şifreler eşleşmiyor",
                }}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    id="confirmPassword"
                    prefix={<LockOutlined />}
                    placeholder="Şifre tekrar"
                    size="large"
                    autoComplete="new-password"
                    maxLength={128}
                    style={styles.input}
                    status={errors.confirmPassword ? "error" : ""}
                  />
                )}
              />
              {errors.confirmPassword && (
                <Text type="danger" style={styles.error}>
                  {errors.confirmPassword.message}
                </Text>
              )}
            </div>
          </div>

          <Text type="secondary" style={styles.hint}>
            Şifre en az 8 karakter olmalı, küçük harf ve rakam içermelidir.
          </Text>

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
            loading={registerLoading}
            style={styles.submit}
          >
            Kaydol
          </Button>
        </form>
      </Card>

      <div style={{ marginTop: 24 }}>
        <Text type="secondary">Zaten hesabın var mı? </Text>
        <Link to="/login" style={styles.link}>
          Giriş yap
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
    maxWidth: 460,
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.06)",
  },
  field: { marginBottom: 16 },
  passwordGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 12,
    marginBottom: 8,
  },
  input: { marginTop: 6 },
  error: { display: "block", marginTop: 4, fontSize: 12 },
  hint: { display: "block", fontSize: 12, marginBottom: 16 },
  submit: {
    background: "var(--color-primary)",
    borderColor: "var(--color-primary)",
    height: 46,
    fontWeight: 600,
  },
  link: { color: "var(--color-primary)", fontWeight: 600 },
  footer: { marginTop: 16, fontSize: 12 },
};

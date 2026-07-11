import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

// ── Özel metrikler ──
const loginDuration = new Trend("login_duration", true);
const conversationsDuration = new Trend("conversations_duration", true);
const usersDuration = new Trend("users_duration", true);
const friendsDuration = new Trend("friends_duration", true);
const errorRate = new Rate("errors");
const loginFailures = new Counter("login_failures");

// ── Yapılandırma ──
const BASE_URL = "https://chatflow-knzm.onrender.com";

const USERS = [
  { userName: "user1", password: "123456" },
  { userName: "user2", password: "123456" },
  { userName: "user3", password: "123456" },
];

// ── Yük profili: kademeli artan (ramp-up) ──
export const options = {
  scenarios: {
    ramping_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },  // 30sn'de 10 sanal kullanıcı
        { duration: "1m", target: 25 },   // 1dk'da 25'e çık
        { duration: "1m", target: 50 },   // 1dk'da 50'ye çık
        { duration: "30s", target: 50 },  // 30sn 50'de kal (dayanıklılık)
        { duration: "30s", target: 0 },   // yavaşça düşür
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<3000"], // isteklerin %95'i 3sn altında olsun
    errors: ["rate<0.1"],              // hata oranı %10'un altında
    login_duration: ["p(95)<5000"],    // login %95 5sn altı (cold start toleransı)
  },
};

export default function () {
  // Her sanal kullanıcı rastgele bir test kullanıcısı seçer
  const user = USERS[Math.floor(Math.random() * USERS.length)];
  let token = null;

  // ── 1) LOGIN ──
  group("login", () => {
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        userName: user.userName,
        password: user.password,
        rememberMe: false,
      }),
      { headers: { "Content-Type": "application/json" } },
    );

    loginDuration.add(res.timings.duration);

    const ok = check(res, {
      "login status 200": (r) => r.status === 200,
      "login token var": (r) => {
        try {
          return JSON.parse(r.body).token != null;
        } catch {
          return false;
        }
      },
    });

    if (ok) {
      token = JSON.parse(res.body).token;
    } else {
      loginFailures.add(1);
      errorRate.add(1);
    }
  });

  if (!token) {
    sleep(1);
    return; // login başarısızsa bu iterasyonu bitir
  }

  const authHeaders = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  sleep(0.5);

  // ── 2) Sohbet listesi ──
  group("conversations", () => {
    const res = http.get(
      `${BASE_URL}/api/message/conversations`,
      authHeaders,
    );
    conversationsDuration.add(res.timings.duration);
    const ok = check(res, { "conversations 200": (r) => r.status === 200 });
    errorRate.add(!ok);
  });

  sleep(0.3);

  // ── 3) Kullanıcı listesi ──
  group("users", () => {
    const res = http.get(`${BASE_URL}/api/user`, authHeaders);
    usersDuration.add(res.timings.duration);
    const ok = check(res, { "users 200": (r) => r.status === 200 });
    errorRate.add(!ok);
  });

  sleep(0.3);

  // ── 4) Arkadaş listesi ──
  group("friends", () => {
    const res = http.get(
      `${BASE_URL}/api/friendship/friends`,
      authHeaders,
    );
    friendsDuration.add(res.timings.duration);
    const ok = check(res, { "friends 200": (r) => r.status === 200 });
    errorRate.add(!ok);
  });

  sleep(1); // kullanıcı düşünme süresi
}
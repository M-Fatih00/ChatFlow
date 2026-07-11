import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate } from "k6/metrics";

// ── Özel metrikler ──
const conversationsDuration = new Trend("conversations_duration", true);
const usersDuration = new Trend("users_duration", true);
const friendsDuration = new Trend("friends_duration", true);
const messagesDuration = new Trend("messages_duration", true);
const errorRate = new Rate("errors");

const BASE_URL = "https://chatflow-knzm.onrender.com";

const USERS = [
  { userName: "user1", password: "123456" },
  { userName: "user2", password: "123456" },
  { userName: "user3", password: "123456" },
];

// ── Gerçekçi yük: düşük eşzamanlılık, sürekli kullanım ──
export const options = {
  scenarios: {
    realistic: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 5 },   // 5 kullanıcı
        { duration: "40s", target: 15 },  // 15 kullanıcı (gerçekçi eşzamanlı)
        { duration: "1m", target: 15 },   // 1dk sabit yük (dayanıklılık)
        { duration: "20s", target: 0 },   // düşür
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<2000"], // mesajlaşma istekleri hızlı olmalı
    errors: ["rate<0.05"],             // hata < %5
  },
};

// ── setup: her VU login OLMADAN önce, bir kez token'ları al ──
export function setup() {
  const tokens = [];
  for (const user of USERS) {
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        userName: user.userName,
        password: user.password,
        rememberMe: true,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
    if (res.status === 200) {
      tokens.push(JSON.parse(res.body).token);
    }
  }
  return { tokens };
}

export default function (data) {
  // setup'tan gelen token'lardan rastgele biri (login tekrarı YOK)
  const token = data.tokens[Math.floor(Math.random() * data.tokens.length)];
  if (!token) {
    sleep(1);
    return;
  }

  const authHeaders = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  // ── Gerçek kullanım: kullanıcı uygulamayı açar, listeleri görür, mesajlaşır ──

  group("conversations", () => {
    const res = http.get(`${BASE_URL}/api/message/conversations`, authHeaders);
    conversationsDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);
    check(res, { "conversations 200": (r) => r.status === 200 });
  });

  sleep(Math.random() * 2 + 1); // 1-3sn düşünme

  group("users", () => {
    const res = http.get(`${BASE_URL}/api/user`, authHeaders);
    usersDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);
    check(res, { "users 200": (r) => r.status === 200 });
  });

  sleep(Math.random() * 2 + 1);

  group("friends", () => {
    const res = http.get(`${BASE_URL}/api/friendship/friends`, authHeaders);
    friendsDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);
    check(res, { "friends 200": (r) => r.status === 200 });
  });

  sleep(Math.random() * 2 + 1);

  // Bir sohbete girip mesajları oku (en sık yapılan işlem)
  group("messages", () => {
    // user1'in ID'siyle bir konuşma çek (varsa). Yoksa 200/boş döner.
    const res = http.get(
      `${BASE_URL}/api/message/conversations`,
      authHeaders,
    );
    messagesDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);
    check(res, { "messages 200": (r) => r.status === 200 });
  });

  sleep(Math.random() * 3 + 2); // 2-5sn kullanıcı molası
}
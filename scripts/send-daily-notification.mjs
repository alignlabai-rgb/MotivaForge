import { readFile } from "node:fs/promises";
import crypto from "node:crypto";

const KCAL_PER_KG = 7700;
const DEFAULT_CURRENT_WEIGHT = 103.4;
const DEFAULT_PLAN_START_DATE = "2026-06-13";
const SITE_URL = "https://alignlabai-rgb.github.io/MotivaForge/";

const TARGET_WEIGHTS_BY_RACE_ID = {
  race_2026_11: 98,
  race_2026_12: 95,
  race_2026_13: 92,
  race_2026_14: 90,
  race_2026_15: 89,
  race_2026_16: 88,
  race_2026_17: 86,
  race_2026_18: 85,
  race_2026_19: 83,
  race_2026_20: 80,
  race_2026_21: 79,
  race_2026_22: 78,
  race_2026_23: 77,
};

const serviceAccount = JSON.parse(requiredEnv("FIREBASE_SERVICE_ACCOUNT"));
const tokens = parseTokens(requiredEnv("FCM_TOKENS"));

const [races, thinkers] = await Promise.all([
  readJson("./data/races.json"),
  readJson("./data/thinkers.json"),
]);

const today = startOfDayInTokyo(new Date());
const nextRace = races
  .filter((race) => race.status !== "completed")
  .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))[0];

if (!nextRace) {
  throw new Error("No upcoming race found.");
}

const raceDate = startOfDayInTokyo(new Date(`${nextRace.date_start}T00:00:00+09:00`));
const days = Math.max(0, Math.ceil((raceDate - today) / 86400000));
const targetWeight = TARGET_WEIGHTS_BY_RACE_ID[nextRace.id];
const todayTarget = getTodayTargetWeight(targetWeight, raceDate, today);
const dailyLoss = days > 0 ? Math.max(0, DEFAULT_CURRENT_WEIGHT - targetWeight) / days : 0;
const dailyDeficit = Math.round(dailyLoss * KCAL_PER_KG);
const thinker = thinkers[Math.floor(seedFromDate(today) % thinkers.length)];

const accessToken = await getAccessToken(serviceAccount);
const title = "MotivaForge";
const body = [
  `今日の目標: ${formatWeight(todayTarget)}`,
  `${nextRace.name}まであと${days}日 / 目標${formatWeight(targetWeight)}`,
  `必要赤字: 約${dailyDeficit.toLocaleString("ja-JP")}kcal/day`,
  `今日の鍛錬: P-${String(thinker.num).padStart(3, "0")} ${thinker.name}`,
].join("\n");

for (const token of tokens) {
  await sendMessage(accessToken, serviceAccount.project_id, token, title, body);
  console.log(`sent ${token.slice(0, 12)}...`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function parseTokens(value) {
  const result = value
    .split(/[\n,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (!result.length) {
    throw new Error("FCM_TOKENS must contain at least one token.");
  }
  return result;
}

async function getAccessToken(account) {
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const jwtClaim = base64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsignedJwt = `${jwtHeader}.${jwtClaim}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsignedJwt)
    .sign(account.private_key, "base64url");
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`OAuth token request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function sendMessage(accessToken, projectId, token, title, body) {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        webpush: {
          fcm_options: { link: SITE_URL },
          notification: {
            title,
            body,
            icon: `${SITE_URL}icons/icon-192.png`,
            badge: `${SITE_URL}icons/icon-192.png`,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`FCM send failed: ${response.status} ${await response.text()}`);
  }
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function startOfDayInTokyo(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type).value;
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00+09:00`);
}

function getTodayTargetWeight(targetWeight, raceDate, today) {
  const startDate = startOfDayInTokyo(new Date(`${DEFAULT_PLAN_START_DATE}T00:00:00+09:00`));
  const totalDays = Math.max(1, Math.ceil((raceDate - startDate) / 86400000));
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.ceil((today - startDate) / 86400000)));
  return DEFAULT_CURRENT_WEIGHT - ((DEFAULT_CURRENT_WEIGHT - targetWeight) * (elapsedDays / totalDays));
}

function formatWeight(value) {
  return `${value.toFixed(1)}kg`;
}

function seedFromDate(date) {
  const key = date.toISOString().slice(0, 10).replaceAll("-", "");
  return Number(key);
}

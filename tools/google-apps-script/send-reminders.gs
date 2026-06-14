const SITE_URL = "https://alignlabai-rgb.github.io/MotivaForge/";
const DEFAULT_CURRENT_WEIGHT = 103.4;
const DEFAULT_PLAN_START_DATE = "2026-06-13";
const WEIGHT_USER_ID = "dzbk";
const KCAL_PER_KG = 7700;

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

function sendMotivaForgeReminder() {
  const props = PropertiesService.getScriptProperties();
  const serviceAccount = JSON.parse(requiredProperty_(props, "FIREBASE_SERVICE_ACCOUNT"));
  const tokens = requiredProperty_(props, "FCM_TOKENS")
    .split(/[\n,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const accessToken = getAccessToken_(serviceAccount);
  const races = fetchJson_(SITE_URL + "data/races.json");
  const thinkers = fetchJson_(SITE_URL + "data/thinkers.json");
  const today = startOfDayJst_(new Date());
  const nextRace = races
    .filter((race) => race.status !== "completed")
    .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))[0];

  if (!nextRace) {
    throw new Error("No upcoming race found.");
  }

  const raceDate = startOfDayJst_(new Date(nextRace.date_start + "T00:00:00+09:00"));
  const days = Math.max(0, Math.ceil((raceDate.getTime() - today.getTime()) / 86400000));
  const targetWeight = TARGET_WEIGHTS_BY_RACE_ID[nextRace.id];
  const todayTarget = getTodayTargetWeight_(targetWeight, raceDate, today);
  const latestWeightLog = getLatestWeightLog_(accessToken, serviceAccount.project_id);
  const currentWeight = latestWeightLog && latestWeightLog.weight ? latestWeightLog.weight : DEFAULT_CURRENT_WEIGHT;
  const remainingLoss = Math.max(0, currentWeight - targetWeight);
  const dailyLoss = days > 0 ? remainingLoss / days : remainingLoss;
  const dailyDeficit = Math.round(dailyLoss * KCAL_PER_KG);
  const thinker = thinkers[Number(Utilities.formatDate(today, "Asia/Tokyo", "yyyyMMdd")) % thinkers.length];

  const title = "MotivaForge";
  const body = [
    "今日の目標: " + formatWeight_(todayTarget),
    "最新体重: " + formatWeight_(currentWeight) + (latestWeightLog ? " (" + latestWeightLog.date + " " + latestWeightLog.time + ")" : ""),
    nextRace.name + "まであと" + days + "日 / 目標" + formatWeight_(targetWeight),
    "必要赤字: 約" + dailyDeficit.toLocaleString("ja-JP") + "kcal/day",
    "今日の鍛錬: P-" + String(thinker.num).padStart(3, "0") + " " + thinker.name,
  ].join("\n");

  tokens.forEach((token) => {
    sendFcm_(accessToken, serviceAccount.project_id, token, title, body);
  });
}

function createReminderTriggers() {
  deleteReminderTriggers();
  [5, 7, 9, 11, 13, 15, 17, 19, 21].forEach((hour) => {
    ScriptApp.newTrigger("sendMotivaForgeReminder")
      .timeBased()
      .atHour(hour)
      .everyDays(1)
      .inTimezone("Asia/Tokyo")
      .create();
  });
}

function deleteReminderTriggers() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === "sendMotivaForgeReminder") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function fetchJson_(url) {
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("Fetch failed " + code + ": " + response.getContentText());
  }
  return JSON.parse(response.getContentText());
}

function getAccessToken_(account) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url_(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url_(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsignedJwt = header + "." + claim;
  const signature = Utilities.computeRsaSha256Signature(unsignedJwt, account.private_key);
  const assertion = unsignedJwt + "." + base64urlBytes_(signature);

  const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    },
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("OAuth failed " + code + ": " + response.getContentText());
  }
  return JSON.parse(response.getContentText()).access_token;
}

function getLatestWeightLog_(accessToken, projectId) {
  const url = "https://firestore.googleapis.com/v1/projects/" + projectId +
    "/databases/(default)/documents/weightLogs/" + WEIGHT_USER_ID +
    "/entries?pageSize=1&orderBy=createdAt%20desc";
  const response = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + accessToken },
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    console.warn("Firestore read failed: " + response.getContentText());
    return null;
  }

  const data = JSON.parse(response.getContentText());
  const fields = data.documents && data.documents[0] && data.documents[0].fields;
  if (!fields) {
    return null;
  }

  return {
    date: fieldValue_(fields.date) || "",
    time: fieldValue_(fields.time) || "",
    weight: Number(fieldValue_(fields.weight) || DEFAULT_CURRENT_WEIGHT),
  };
}

function sendFcm_(accessToken, projectId, token, title, body) {
  const response = UrlFetchApp.fetch("https://fcm.googleapis.com/v1/projects/" + projectId + "/messages:send", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + accessToken },
    payload: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        webpush: {
          fcm_options: { link: SITE_URL },
          notification: { title, body },
        },
      },
    }),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("FCM failed " + code + ": " + response.getContentText());
  }
}

function getTodayTargetWeight_(targetWeight, raceDate, today) {
  const startDate = startOfDayJst_(new Date(DEFAULT_PLAN_START_DATE + "T00:00:00+09:00"));
  const totalDays = Math.max(1, Math.ceil((raceDate.getTime() - startDate.getTime()) / 86400000));
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / 86400000)));
  return DEFAULT_CURRENT_WEIGHT - ((DEFAULT_CURRENT_WEIGHT - targetWeight) * (elapsedDays / totalDays));
}

function startOfDayJst_(date) {
  const key = Utilities.formatDate(date, "Asia/Tokyo", "yyyy-MM-dd");
  return new Date(key + "T00:00:00+09:00");
}

function formatWeight_(value) {
  return Number(value).toFixed(1) + "kg";
}

function fieldValue_(field) {
  if (!field) return null;
  if (Object.prototype.hasOwnProperty.call(field, "stringValue")) return field.stringValue;
  if (Object.prototype.hasOwnProperty.call(field, "doubleValue")) return field.doubleValue;
  if (Object.prototype.hasOwnProperty.call(field, "integerValue")) return field.integerValue;
  if (Object.prototype.hasOwnProperty.call(field, "timestampValue")) return field.timestampValue;
  return null;
}

function requiredProperty_(props, name) {
  const value = props.getProperty(name);
  if (!value) {
    throw new Error(name + " script property is required.");
  }
  return value;
}

function base64url_(value) {
  return base64urlBytes_(Utilities.newBlob(value).getBytes());
}

function base64urlBytes_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, "");
}

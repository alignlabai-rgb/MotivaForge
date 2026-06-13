const state = {
  thinkers: [],
  races: [],
  currentThinker: null,
  thinkerMode: "essence",
  timerSeconds: 25 * 60,
  timerPreset: 25 * 60,
  timerId: null,
  weightLogs: [],
  firestore: null,
};

const DEFAULT_CURRENT_WEIGHT = 103.4;
const DEFAULT_PLAN_START_DATE = "2026-06-13";
const KCAL_PER_KG = 7700;
const WEIGHT_USER_ID = "dzbk";
const FIREBASE_VAPID_KEY = "BIz0AsnSDc92QsHmpWQ4pYQUq-Rl5onSFmR83SJGNgVfDUTXlKkUFwEnnzMMBXIl-6sTppx0_BtAnCS6y1zBfAg";

const firebaseConfig = {
  apiKey: "AIzaSyBycYbj3tlRE5Z9HmeecNUTdMjc9BSYh5Y",
  authDomain: "motiveforge-77b00.firebaseapp.com",
  projectId: "motiveforge-77b00",
  storageBucket: "motiveforge-77b00.firebasestorage.app",
  messagingSenderId: "25502053073",
  appId: "1:25502053073:web:9bade518d88dac30bfcbf0",
  measurementId: "G-JNZL5P14TS",
};

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

const elements = {
  todayLabel: document.querySelector("#todayLabel"),
  timeLabel: document.querySelector("#timeLabel"),
  raceCountdown: document.querySelector("#raceCountdown"),
  nextRaceName: document.querySelector("#nextRaceName"),
  nextRaceMeta: document.querySelector("#nextRaceMeta"),
  nextRaceDistance: document.querySelector("#nextRaceDistance"),
  nextRaceLimit: document.querySelector("#nextRaceLimit"),
  nextRaceStatus: document.querySelector("#nextRaceStatus"),
  nextRaceTarget: document.querySelector("#nextRaceTarget"),
  nextRacePace: document.querySelector("#nextRacePace"),
  todayTargetWeight: document.querySelector("#todayTargetWeight"),
  todayTargetNote: document.querySelector("#todayTargetNote"),
  dailyLine: document.querySelector("#dailyLine"),
  drawDailyButton: document.querySelector("#drawDailyButton"),
  weightForm: document.querySelector("#weightForm"),
  weightInput: document.querySelector("#weightInput"),
  latestWeight: document.querySelector("#latestWeight"),
  weightCount: document.querySelector("#weightCount"),
  weightDelta: document.querySelector("#weightDelta"),
  weightLog: document.querySelector("#weightLog"),
  raceList: document.querySelector("#raceList"),
  raceCountBadge: document.querySelector("#raceCountBadge"),
  observeCurrentWeight: document.querySelector("#observeCurrentWeight"),
  observeTodayTarget: document.querySelector("#observeTodayTarget"),
  observeDailyDeficit: document.querySelector("#observeDailyDeficit"),
  observationTable: document.querySelector("#observationTable"),
  notificationStatus: document.querySelector("#notificationStatus"),
  enableNotificationsButton: document.querySelector("#enableNotificationsButton"),
  notificationStatusSecondary: document.querySelector("#notificationStatusSecondary"),
  enableNotificationsButtonSecondary: document.querySelector("#enableNotificationsButtonSecondary"),
  fcmTokenText: document.querySelector("#fcmTokenText"),
  thinkerCount: document.querySelector("#thinkerCount"),
  thinkerNumber: document.querySelector("#thinkerNumber"),
  thinkerName: document.querySelector("#thinkerName"),
  thinkerEnglish: document.querySelector("#thinkerEnglish"),
  thinkerText: document.querySelector("#thinkerText"),
  randomThinkerButton: document.querySelector("#randomThinkerButton"),
  copyThinkerButton: document.querySelector("#copyThinkerButton"),
  timerDisplay: document.querySelector("#timerDisplay"),
  timerStart: document.querySelector("#timerStart"),
  timerReset: document.querySelector("#timerReset"),
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "short",
  day: "numeric",
  weekday: "short",
});

const fullDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

init();

async function init() {
  bindNavigation();
  bindThinkerControls();
  bindWeightControls();
  bindTimerControls();
  bindNotificationControls();
  startClock();

  try {
    const [thinkers, races] = await Promise.all([
      fetchJson("./data/thinkers.json"),
      fetchJson("./data/races.json"),
    ]);

    state.thinkers = thinkers;
    state.races = races;

    await initFirestore();
    renderRaceDashboard();
    drawThinker();
    renderDailyLine();
    renderWeightLog();
  } catch (error) {
    showLoadError(error);
  }
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`${path} の読み込みに失敗しました`);
  }
  return response.json();
}

async function getFirebaseApp() {
  if (state.firebaseApp) {
    return state.firebaseApp;
  }

  const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js");
  state.firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return state.firebaseApp;
}

async function initFirestore() {
  try {
    const app = await getFirebaseApp();
    const firestoreModule = await import("https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js");
    const { getFirestore, collection, query, orderBy, limit, onSnapshot } = firestoreModule;
    state.firestoreModule = firestoreModule;
    state.firestore = getFirestore(app);

    const logsQuery = query(
      collection(state.firestore, "weightLogs", WEIGHT_USER_ID, "entries"),
      orderBy("createdAt", "desc"),
      limit(30),
    );

    onSnapshot(logsQuery, (snapshot) => {
      state.weightLogs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      renderWeightLog();
      renderRaceDashboard();
    }, (error) => {
      console.warn("Firestore sync failed", error);
      state.weightLogs = getLocalWeightLogs();
      renderWeightLog();
      renderRaceDashboard();
    });
  } catch (error) {
    console.warn("Firestore init failed", error);
    state.weightLogs = getLocalWeightLogs();
  }
}

async function saveWeightLog(weight) {
  const now = new Date();
  const entry = {
    date: toDateKey(now),
    time: toTimeKey(now),
    weight,
    source: "web",
  };

  elements.weightInput.disabled = true;
  try {
    if (!state.firestore || !state.firestoreModule) {
      await initFirestore();
    }

    if (state.firestore && state.firestoreModule) {
      const { addDoc, collection, serverTimestamp } = state.firestoreModule;
      await addDoc(collection(state.firestore, "weightLogs", WEIGHT_USER_ID, "entries"), {
        ...entry,
        createdAt: serverTimestamp(),
      });
    } else {
      saveLocalWeightLog(entry);
      state.weightLogs = getLocalWeightLogs();
      renderWeightLog();
      renderRaceDashboard();
    }
    elements.weightInput.value = "";
  } catch (error) {
    saveLocalWeightLog(entry);
    state.weightLogs = getLocalWeightLogs();
    renderWeightLog();
    renderRaceDashboard();
    console.warn("Saved weight locally after Firestore write failed", error);
  } finally {
    elements.weightInput.disabled = false;
  }
}

function bindNavigation() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#${button.dataset.view}`).classList.add("active");
    });
  });
}

function bindThinkerControls() {
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".mode-button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.thinkerMode = button.dataset.mode;
      renderThinker();
    });
  });

  elements.randomThinkerButton.addEventListener("click", drawThinker);
  elements.drawDailyButton.addEventListener("click", renderDailyLine);
  elements.copyThinkerButton.addEventListener("click", copyThinkerCard);
}

function bindWeightControls() {
  elements.weightForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = Number(elements.weightInput.value);
    if (!Number.isFinite(value) || value <= 0) {
      elements.weightInput.focus();
      return;
    }

    await saveWeightLog(Math.round(value * 10) / 10);
  });
}

function bindTimerControls() {
  document.querySelectorAll("[data-minutes]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-minutes]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.timerPreset = Number(button.dataset.minutes) * 60;
      resetTimer();
    });
  });

  elements.timerStart.addEventListener("click", toggleTimer);
  elements.timerReset.addEventListener("click", resetTimer);
  renderTimer();
}

function bindNotificationControls() {
  const buttons = [
    elements.enableNotificationsButton,
    elements.enableNotificationsButtonSecondary,
  ].filter(Boolean);

  if (!buttons.length) {
    return;
  }

  refreshNotificationStatus();
  buttons.forEach((button) => {
    button.addEventListener("click", enablePushNotifications);
  });
}

function refreshNotificationStatus() {
  const statuses = [
    elements.notificationStatus,
    elements.notificationStatusSecondary,
  ].filter(Boolean);
  const buttons = [
    elements.enableNotificationsButton,
    elements.enableNotificationsButtonSecondary,
  ].filter(Boolean);

  if (!("Notification" in window)) {
    statuses.forEach((status) => {
      status.textContent = "非対応";
    });
    buttons.forEach((button) => {
      button.disabled = true;
    });
    return;
  }

  const labels = {
    default: "未許可",
    granted: "許可済み",
    denied: "拒否中",
  };
  statuses.forEach((status) => {
    status.textContent = labels[Notification.permission] || Notification.permission;
  });
  buttons.forEach((button) => {
    button.textContent = Notification.permission === "granted" ? "Tokenを再取得" : "通知を有効化";
  });
}

async function enablePushNotifications() {
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      throw new Error("このブラウザはWeb Push通知に対応していません。");
    }

    setNotificationStatus("確認中");
    const permission = await Notification.requestPermission();
    refreshNotificationStatus();

    if (permission !== "granted") {
      elements.fcmTokenText.textContent = "通知が許可されていません。ブラウザ設定を確認してください。";
      return;
    }

    const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
    const { getMessaging, getToken, onMessage } = await import("https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging.js");
    const app = await getFirebaseApp();
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      throw new Error("FCM tokenを取得できませんでした。");
    }

    localStorage.setItem("motivaforge.fcmToken", token);
    setNotificationStatus("準備完了");
    elements.fcmTokenText.textContent = token;

    onMessage(messaging, (payload) => {
      showInAppNotification(payload.notification?.title || "MotivaForge", payload.notification?.body || "通知を受信しました。");
    });
  } catch (error) {
    setNotificationStatus("設定エラー");
    elements.fcmTokenText.textContent = error.message;
  }
}

function setNotificationStatus(text) {
  [
    elements.notificationStatus,
    elements.notificationStatusSecondary,
  ].filter(Boolean).forEach((status) => {
    status.textContent = text;
  });
}

function showInAppNotification(title, body) {
  const toast = document.createElement("div");
  toast.className = "notification-toast";
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span>`;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 6000);
}

function startClock() {
  const tick = () => {
    const now = new Date();
    elements.todayLabel.textContent = dateFormatter.format(now);
    elements.timeLabel.textContent = timeFormatter.format(now);
  };

  tick();
  window.setInterval(tick, 1000);
}

function renderRaceDashboard() {
  const today = startOfDay(new Date());
  const currentWeight = getCurrentWeight();
  const upcoming = state.races
    .filter((race) => race.status !== "completed")
    .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
  const nextRace = upcoming[0] || state.races[state.races.length - 1];

  elements.raceCountBadge.textContent = `${state.races.length} races`;
  renderNextRace(nextRace, today, currentWeight);
  renderRaceList(upcoming.length ? upcoming : state.races, today, currentWeight);
  renderObservationTable(upcoming.length ? upcoming : state.races, today, currentWeight, nextRace);
}

function renderNextRace(race, today, currentWeight) {
  if (!race) {
    return;
  }

  const raceDate = startOfDay(new Date(race.date_start));
  const days = Math.max(0, Math.ceil((raceDate - today) / 86400000));
  const targetWeight = TARGET_WEIGHTS_BY_RACE_ID[race.id];
  const plan = getWeightPlan(currentWeight, targetWeight, days);
  const todayTarget = getTodayTargetWeight(targetWeight, raceDate, today);
  elements.raceCountdown.innerHTML = `<span class="count-value">${days}</span><span class="count-unit">days</span>`;
  elements.nextRaceName.textContent = race.name;
  elements.nextRaceMeta.textContent = `${formatDateRange(race)} / ${race.notes || "notesなし"}`;
  elements.nextRaceDistance.textContent = race.distance_label || `${race.distance_km}km`;
  elements.nextRaceLimit.textContent = race.time_limit || "--";
  elements.nextRaceStatus.textContent = statusLabel(race.status);
  elements.nextRaceTarget.textContent = formatWeight(targetWeight);
  elements.nextRacePace.textContent = plan ? `${plan.dailyLoss.toFixed(2)} kg/day` : "--";
  elements.todayTargetWeight.textContent = formatWeight(todayTarget);
  elements.todayTargetNote.textContent = plan
    ? `現在との差 ${formatSigned(currentWeight - todayTarget)} kg`
    : "--";
}

function renderRaceList(races, today, currentWeight) {
  elements.raceList.innerHTML = "";
  races.slice(0, 13).forEach((race) => {
    const days = Math.max(0, Math.ceil((startOfDay(new Date(race.date_start)) - today) / 86400000));
    const targetWeight = TARGET_WEIGHTS_BY_RACE_ID[race.id];
    const plan = getWeightPlan(currentWeight, targetWeight, days);
    const item = document.createElement("article");
    item.className = "race-item";
    item.innerHTML = `
      <div class="race-date">
        <strong>${formatShortDate(race.date_start)}</strong>
        <span>${days} days</span>
      </div>
      <div>
        <div class="race-title">${escapeHtml(race.name)}</div>
        <div class="race-sub">${escapeHtml(race.distance_label)} / ${escapeHtml(race.time_limit || "--")}</div>
        <div class="race-weight-plan">
          <span>目標 ${formatWeight(targetWeight)}</span>
          <span>残り ${plan ? plan.lossText : "--"}</span>
          <span>${plan ? plan.dailyLoss.toFixed(2) : "--"} kg/day</span>
        </div>
      </div>
      <span class="pill status-${escapeHtml(race.status)}">${escapeHtml(statusLabel(race.status))}</span>
    `;
    elements.raceList.append(item);
  });
}

function renderObservationTable(races, today, currentWeight, nextRace) {
  if (!elements.observationTable) {
    return;
  }

  const nextRaceDate = nextRace ? startOfDay(new Date(nextRace.date_start)) : today;
  const nextTarget = nextRace ? TARGET_WEIGHTS_BY_RACE_ID[nextRace.id] : null;
  const todayTarget = getTodayTargetWeight(nextTarget, nextRaceDate, today);
  const nextDays = nextRace ? Math.max(0, Math.ceil((nextRaceDate - today) / 86400000)) : 0;
  const nextPlan = getWeightPlan(currentWeight, nextTarget, nextDays);

  elements.observeCurrentWeight.textContent = formatWeight(currentWeight);
  elements.observeTodayTarget.textContent = formatWeight(todayTarget);
  elements.observeDailyDeficit.textContent = nextPlan
    ? `${Math.round(nextPlan.dailyLoss * KCAL_PER_KG).toLocaleString()} kcal/day`
    : "--";

  elements.observationTable.innerHTML = "";
  races.slice(0, 13).forEach((race) => {
    const raceDate = startOfDay(new Date(race.date_start));
    const days = Math.max(0, Math.ceil((raceDate - today) / 86400000));
    const targetWeight = TARGET_WEIGHTS_BY_RACE_ID[race.id];
    const theoreticalToday = getTodayTargetWeight(targetWeight, raceDate, today);
    const plan = getWeightPlan(currentWeight, targetWeight, days);
    const row = document.createElement("article");
    row.className = "observation-row";
    row.innerHTML = `
      <div>
        <span class="race-date">${formatShortDate(race.date_start)} / ${days} days</span>
        <strong>${escapeHtml(race.name)}</strong>
      </div>
      <div>
        <span class="metric-label">Today</span>
        <strong>${formatWeight(theoreticalToday)}</strong>
      </div>
      <div>
        <span class="metric-label">Race</span>
        <strong>${formatWeight(targetWeight)}</strong>
      </div>
      <div>
        <span class="metric-label">Deficit</span>
        <strong>${plan ? Math.round(plan.dailyLoss * KCAL_PER_KG).toLocaleString() : "--"} kcal/day</strong>
      </div>
    `;
    elements.observationTable.append(row);
  });
}

function drawThinker() {
  if (!state.thinkers.length) {
    return;
  }

  const index = Math.floor(Math.random() * state.thinkers.length);
  state.currentThinker = state.thinkers[index];
  renderThinker();
}

function renderThinker() {
  const thinker = state.currentThinker;
  if (!thinker) {
    return;
  }

  elements.thinkerCount.textContent = `${state.thinkers.length} people`;
  elements.thinkerNumber.textContent = `P-${String(thinker.num).padStart(3, "0")}`;
  elements.thinkerName.textContent = thinker.name;
  elements.thinkerEnglish.textContent = thinker.en_name;
  elements.thinkerText.textContent = thinker[state.thinkerMode] || thinker.essence;
}

function renderDailyLine() {
  if (!state.thinkers.length) {
    return;
  }

  const thinker = state.thinkers[Math.floor(Math.random() * state.thinkers.length)];
  const mode = ["essence", "question", "debate"][Math.floor(Math.random() * 3)];
  const label = { essence: "本質", question: "問い", debate: "論点" }[mode];
  elements.dailyLine.textContent = `P-${String(thinker.num).padStart(3, "0")} ${thinker.name} / ${label}: ${thinker[mode]}`;
}

async function copyThinkerCard() {
  if (!state.currentThinker) {
    return;
  }

  const thinker = state.currentThinker;
  const text = [
    `P-${String(thinker.num).padStart(3, "0")}`,
    `${thinker.name} / ${thinker.en_name}`,
    thinker[state.thinkerMode] || thinker.essence,
  ].join("\n");

  await navigator.clipboard.writeText(text);
  elements.copyThinkerButton.textContent = "Copied";
  window.setTimeout(() => {
    elements.copyThinkerButton.textContent = "コピー";
  }, 1200);
}

function renderWeightLog() {
  const logs = getWeightLogs();
  elements.weightLog.innerHTML = "";
  elements.weightCount.textContent = logs.length;

  if (!logs.length) {
    elements.latestWeight.textContent = `${DEFAULT_CURRENT_WEIGHT.toFixed(1)} kg`;
    elements.weightDelta.textContent = "baseline";
    const empty = document.createElement("li");
    empty.innerHTML = "<span>まだ記録がありません</span><strong>--</strong>";
    empty.innerHTML = `<span>基準値</span><strong>${DEFAULT_CURRENT_WEIGHT.toFixed(1)} kg</strong>`;
    elements.weightLog.append(empty);
    return;
  }

  const latest = logs[0];
  const previous = logs[1];
  elements.latestWeight.textContent = `${latest.weight.toFixed(1)} kg`;
  elements.weightDelta.textContent = previous ? `${formatSigned(latest.weight - previous.weight)} kg` : "first";

  logs.slice(0, 8).forEach((entry) => {
    const item = document.createElement("li");
    item.innerHTML = `<span>${escapeHtml(entry.date)} ${escapeHtml(entry.time || "")}</span><strong>${Number(entry.weight).toFixed(1)} kg</strong>`;
    elements.weightLog.append(item);
  });
}

function getWeightLogs() {
  return state.weightLogs.length ? state.weightLogs : getLocalWeightLogs();
}

function getLocalWeightLogs() {
  try {
    const logs = JSON.parse(localStorage.getItem("motivaforge.weightLogs") || "[]");
    return Array.isArray(logs) ? logs : [];
  } catch {
    return [];
  }
}

function saveLocalWeightLog(entry) {
  const logs = getLocalWeightLogs();
  localStorage.setItem("motivaforge.weightLogs", JSON.stringify([
    {
      ...entry,
      createdAt: new Date().toISOString(),
    },
    ...logs,
  ].slice(0, 30)));
}

function getCurrentWeight() {
  return getWeightLogs()[0]?.weight || DEFAULT_CURRENT_WEIGHT;
}

function getWeightPlan(currentWeight, targetWeight, days) {
  if (!targetWeight || !Number.isFinite(currentWeight)) {
    return null;
  }

  const totalLoss = Math.max(0, currentWeight - targetWeight);
  const dailyLoss = days > 0 ? totalLoss / days : totalLoss;
  return {
    totalLoss,
    dailyLoss,
    lossText: `${totalLoss.toFixed(1)} kg`,
  };
}

function formatWeight(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} kg` : "--";
}

function getTodayTargetWeight(targetWeight, raceDate, today) {
  if (!targetWeight) {
    return null;
  }

  const startDate = startOfDay(new Date(DEFAULT_PLAN_START_DATE));
  const totalDays = Math.max(1, Math.ceil((raceDate - startDate) / 86400000));
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.ceil((today - startDate) / 86400000)));
  const progress = elapsedDays / totalDays;
  return DEFAULT_CURRENT_WEIGHT - ((DEFAULT_CURRENT_WEIGHT - targetWeight) * progress);
}

function toggleTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
    elements.timerStart.textContent = "Start";
    return;
  }

  elements.timerStart.textContent = "Pause";
  state.timerId = window.setInterval(() => {
    state.timerSeconds = Math.max(0, state.timerSeconds - 1);
    renderTimer();
    if (state.timerSeconds === 0) {
      window.clearInterval(state.timerId);
      state.timerId = null;
      elements.timerStart.textContent = "Start";
    }
  }, 1000);
}

function resetTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
  state.timerSeconds = state.timerPreset;
  elements.timerStart.textContent = "Start";
  renderTimer();
}

function renderTimer() {
  const minutes = Math.floor(state.timerSeconds / 60);
  const seconds = state.timerSeconds % 60;
  elements.timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function showLoadError(error) {
  elements.nextRaceName.textContent = "データ読み込みエラー";
  elements.nextRaceMeta.textContent = error.message;
  elements.thinkerName.textContent = "データ読み込みエラー";
  elements.thinkerText.textContent = "ローカルファイルを直接開く場合、ブラウザの制限で fetch が失敗することがあります。ローカルサーバー経由で開いてください。";
}

function formatDateRange(race) {
  const start = fullDateFormatter.format(new Date(race.date_start));
  const end = fullDateFormatter.format(new Date(race.date_end));
  return start === end ? start : `${start} - ${end}`;
}

function formatShortDate(dateText) {
  const date = new Date(dateText);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function statusLabel(status) {
  return {
    completed: "完了",
    ready: "準備済み",
    confirmed: "確定",
    needs_transport: "交通手配",
    needs_entry: "エントリー",
  }[status] || status;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeKey(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatSigned(value) {
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? `+${rounded.toFixed(1)}` : rounded.toFixed(1);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

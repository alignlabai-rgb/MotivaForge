importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBycYbj3tlRE5Z9HmeecNUTdMjc9BSYh5Y",
  authDomain: "motiveforge-77b00.firebaseapp.com",
  projectId: "motiveforge-77b00",
  storageBucket: "motiveforge-77b00.firebasestorage.app",
  messagingSenderId: "25502053073",
  appId: "1:25502053073:web:9bade518d88dac30bfcbf0",
  measurementId: "G-JNZL5P14TS",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "MotivaForge";
  const options = {
    body: payload.notification?.body || "今日の目標を確認してください。",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    data: payload.data || {},
  };

  self.registration.showNotification(title, options);
});

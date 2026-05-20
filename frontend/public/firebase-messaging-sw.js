importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDONg71QkI2r0RLD2DM_C3GBP5PaE7nBu0",
  authDomain: "ptrv-22b15.firebaseapp.com",
  projectId: "ptrv-22b15",
  storageBucket: "ptrv-22b15.firebasestorage.app",
  messagingSenderId: "762656666943",
  appId: "1:762656666943:web:4a0abfbb5473ea5b440f8a"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

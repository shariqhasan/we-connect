// ✅ random-matching.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, push, set, onChildAdded, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyASlmUQeDx8EdW-n8KT7dqFA13yloBIPt8",
  authDomain: "we-connect-847f4.firebaseapp.com",
  databaseURL: "https://we-connect-847f4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "we-connect-847f4",
  storageBucket: "we-connect-847f4.appspot.com",
  messagingSenderId: "530150260251",
  appId: "1:530150260251:web:abc123def456gh789ijk"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const queueRef = ref(db, "matchQueue");

// 🚀 Start Random Matching
window.startRandomMatch = async () => {
  const myRef = push(queueRef);
  await set(myRef, { timestamp: Date.now() });

  // Listen for other users
  onChildAdded(queueRef, async (snapshot) => {
    const otherUserKey = snapshot.key;
    if (otherUserKey !== myRef.key) {
      const roomId = `${myRef.key}_${otherUserKey}`;

      // Clean queue
      await remove(ref(db, `matchQueue/${myRef.key}`));
      await remove(ref(db, `matchQueue/${otherUserKey}`));

      // Set room
      await set(ref(db, `rooms/${roomId}`), {
        users: [myRef.key, otherUserKey],
        createdAt: Date.now()
      });

      // Redirect both users
      window.location.href = `index.html?room=${roomId}`;
    }
  });
};

// ✅ random-matching.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  onChildAdded,
  remove,
  get,
  child
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
const roomsRef = ref(db, "rooms");

let matched = false; // ✅ prevent multiple redirects

// 🚀 Start Random Match
window.startRandomMatch = async () => {
  try {
    const myRef = push(queueRef);
    await set(myRef, { timestamp: Date.now() });

    const unsubscribe = onChildAdded(queueRef, async (snapshot) => {
      const otherUserKey = snapshot.key;
      if (!matched && otherUserKey !== myRef.key) {
        matched = true;

        const roomId = `${myRef.key}_${otherUserKey}`;

        // Clean the queue
        await remove(ref(db, `matchQueue/${myRef.key}`));
        await remove(ref(db, `matchQueue/${otherUserKey}`));

        // Create a room
        await set(ref(db, `rooms/${roomId}`), {
          users: [myRef.key, otherUserKey],
          createdAt: Date.now()
        });

        // Redirect both users
        window.location.href = `video-call.html?room=${roomId}`;
      }
    });

    // Fallback: Remove from queue after timeout (e.g., 60 seconds)
    setTimeout(async () => {
      if (!matched) {
        await remove(myRef);
        alert("⚠️ No match found. Please try again.");
        matched = true;
        unsubscribe(); // stop listening
      }
    }, 60000);

  } catch (err) {
    console.error("Matching failed:", err);
    alert("❌ Error while matching. Try again later.");
  }
};

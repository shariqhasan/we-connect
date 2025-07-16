// ✅ firebase-config.js (v10+ using ES Modules)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ✅ Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyASlmUQeDx8EdW-n8KT7dqFA13yloBIPt8",
  authDomain: "we-connect-847f4.firebaseapp.com",
  projectId: "we-connect-847f4",
  storageBucket: "we-connect-847f4.appspot.com",
  messagingSenderId: "530150260251",
  appId: "1:530150260251:web:abc123def456gh789ijk",
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ✅ Attach login function to global scope
window.googleLogin = () => {
  signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      console.log("✅ Login success:", user.displayName);
      // Redirect after login
      window.location.href = "home.html";
    })
    .catch((error) => {
      console.error("❌ Login error:", error.message);
      alert("Login failed: " + error.message);
    });
};

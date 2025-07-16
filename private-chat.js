// ✅ private-chat.js (ES module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot,
  collection, addDoc, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyASlmUQeDx8EdW-n8KT7dqFA13yloBIPt8",
  authDomain: "we-connect-847f4.firebaseapp.com",
  projectId: "we-connect-847f4",
  storageBucket: "we-connect-847f4.appspot.com",
  messagingSenderId: "530150260251",
  appId: "1:530150260251:web:abc123def456gh789ijk"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let pendingCandidates = [];

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

window.addEventListener('DOMContentLoaded', () => {
  const chatMessages = document.getElementById('chatBox');
  const chatInput = document.getElementById('chatInput');
  const sendMessageBtn = document.getElementById('sendMessage');
  const startVideoCall = document.getElementById('videoCall');
  const startVoiceCall = document.getElementById('voiceCall');
  const endCallBtn = document.getElementById('endCall');
  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');
  const videoWrapper = document.getElementById('videoWrapper');

  if (!chatMessages || !chatInput || !sendMessageBtn || !startVideoCall || !startVoiceCall || !endCallBtn || !localVideo || !remoteVideo || !videoWrapper) {
    console.error("❌ One or more DOM elements not found. Check your HTML IDs.");
    return;
  }

  // ✅ Auth
  signInAnonymously(auth).catch(console.error);
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      await setDoc(doc(db, "status", user.uid), {
        online: true,
        lastSeen: serverTimestamp(),
      });
      listenToMessages();
      listenToIncomingCall();
    }
  });

  sendMessageBtn.onclick = async () => {
    const text = chatInput.value.trim();
    if (!text) return;
    await addDoc(collection(db, "privateMessages"), {
      from: currentUser.uid,
      message: text,
      timestamp: serverTimestamp(),
    });
    chatInput.value = "";
  };

  function listenToMessages() {
    const messagesRef = collection(db, "privateMessages");
    onSnapshot(messagesRef, snapshot => {
      chatMessages.innerHTML = "";
      snapshot.forEach(doc => {
        const data = doc.data();
        const msg = document.createElement("div");
        msg.classList.add("message", data.from === currentUser.uid ? "sent" : "received");
        msg.textContent = data.message;
        chatMessages.appendChild(msg);
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  async function openMedia(video = true) {
    const constraints = video ? { video: true, audio: true } : { audio: true };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    remoteStream = new MediaStream();
    localVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;
    videoWrapper.style.display = "flex";
  }

  async function startCall(video = true) {
    await openMedia(video);
    peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => {
      event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
    };

    const callRef = doc(collection(db, "calls"));
    await setDoc(callRef, {
      from: currentUser.uid,
      to: "receiver-id-placeholder", // ⛳ Update this dynamically
      status: "ringing"
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await updateDoc(callRef, {
      offer: {
        type: offer.type,
        sdp: offer.sdp
      }
    });

    peerConnection.onicecandidate = async event => {
      if (event.candidate) {
        await addDoc(collection(callRef, "ice"), event.candidate.toJSON());
      }
    };

    onSnapshot(callRef, async (snap) => {
      const data = snap.data();
      if (data?.answer && !peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        // 🔁 Add pending ICE candidates now
        for (const c of pendingCandidates) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingCandidates = [];
      }
    });

    onSnapshot(collection(callRef, "ice"), (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === "added") {
          const c = change.doc.data();
          if (peerConnection.remoteDescription) {
            peerConnection.addIceCandidate(new RTCIceCandidate(c));
          } else {
            pendingCandidates.push(c);
          }
        }
      });
    });
  }

  function listenToIncomingCall() {
    const callsRef = collection(db, "calls");
    onSnapshot(callsRef, async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const call = change.doc.data();
          if (call.to === currentUser.uid && call.status === "ringing") {
            const accept = confirm("📞 Incoming call. Accept?");
            if (accept) {
              peerConnection = new RTCPeerConnection(config);
              remoteStream = new MediaStream();
              remoteVideo.srcObject = remoteStream;

              peerConnection.ontrack = event => {
                event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
              };

              const offer = call.offer;
              await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

              const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
              localStream = stream;
              localVideo.srcObject = stream;
              stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);
              await updateDoc(doc(db, "calls", change.doc.id), {
                answer: {
                  type: answer.type,
                  sdp: answer.sdp
                },
                status: "connected"
              });

              videoWrapper.style.display = "flex";

              peerConnection.onicecandidate = async event => {
                if (event.candidate) {
                  await addDoc(collection(doc(db, "calls", change.doc.id), "ice"), event.candidate.toJSON());
                }
              };

              onSnapshot(collection(doc(db, "calls", change.doc.id), "ice"), (snapshot) => {
                snapshot.docChanges().forEach(change => {
                  const c = change.doc.data();
                  if (peerConnection.remoteDescription) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(c));
                  } else {
                    pendingCandidates.push(c);
                  }
                });
              });
            } else {
              await updateDoc(doc(db, "calls", change.doc.id), { status: "rejected" });
            }
          }
        }
      });
    });
  }

  function hangupCall() {
    peerConnection?.close();
    peerConnection = null;
    localStream?.getTracks().forEach(track => track.stop());
    remoteStream?.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    videoWrapper.style.display = "none";
  }

  startVideoCall.onclick = () => startCall(true);
  startVoiceCall.onclick = () => startCall(false);
  endCallBtn.onclick = hangupCall;
});

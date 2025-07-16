import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc, setDoc, getDoc, updateDoc,
  collection, onSnapshot, addDoc
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
const db = getFirestore(app);

// URL Param
const roomId = new URLSearchParams(window.location.search).get("room");
if (!roomId) alert("Missing room ID");

// Elements
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const endCall = document.getElementById("endCall");

// Variables
const peerConnection = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});
let localStream, remoteStream = new MediaStream();

localVideo.srcObject = localStream;
remoteVideo.srcObject = remoteStream;

// Step 1: Get mic/cam
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
  localStream = stream;
  localVideo.srcObject = stream;
  stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
}).catch(e => {
  alert("❌ Please allow mic and camera.");
  console.error(e);
});

// Step 2: Handle remote stream
peerConnection.ontrack = (event) => {
  event.streams[0].getTracks().forEach(track => {
    remoteStream.addTrack(track);
  });
  remoteVideo.srcObject = remoteStream;
};

// Step 3: ICE Candidate handling
peerConnection.onicecandidate = async (event) => {
  if (event.candidate) {
    const coll = collection(db, `rooms/${roomId}/${isCaller ? 'offerCandidates' : 'answerCandidates'}`);
    await addDoc(coll, event.candidate.toJSON());
  }
};

const roomRef = doc(db, "rooms", roomId);
let isCaller = false;

(async () => {
  const roomSnap = await getDoc(roomRef);

  if (roomSnap.exists() && roomSnap.data()?.offer) {
    // Answerer
    const offerDesc = roomSnap.data().offer;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offerDesc));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await updateDoc(roomRef, { answer });

    const offerCandidates = collection(db, `rooms/${roomId}/offerCandidates`);
    onSnapshot(offerCandidates, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          peerConnection.addIceCandidate(candidate);
        }
      });
    });
  } else {
    // Caller
    isCaller = true;
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await setDoc(roomRef, { offer });

    onSnapshot(roomRef, async (snap) => {
      const data = snap.data();
      if (data?.answer && !peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    const answerCandidates = collection(db, `rooms/${roomId}/answerCandidates`);
    onSnapshot(answerCandidates, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          peerConnection.addIceCandidate(candidate);
        }
      });
    });
  }
})();

// End call
endCall.onclick = () => {
  peerConnection.close();
  localStream.getTracks().forEach(t => t.stop());
  remoteStream.getTracks().forEach(t => t.stop());
  window.location.href = "home.html";
};

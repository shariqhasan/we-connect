// ✅ video-call.js (module that enables video call between 2 random users using Firebase)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot,
  collection, addDoc, serverTimestamp, updateDoc, query, where, getDocs
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
let callDoc = null;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const endCallBtn = document.getElementById("endCall");

// ✅ Auth and Setup
signInAnonymously(auth).catch(console.error);
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await matchRandomUser();
  }
});

// ✅ Matching logic
async function matchRandomUser() {
  const matchRef = collection(db, "videoMatch");
  const q = query(matchRef, where("matched", "==", false));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const matchDoc = snapshot.docs[0];
    const matchId = matchDoc.id;
    await updateDoc(doc(db, "videoMatch", matchId), {
      matched: true,
      peer2: currentUser.uid,
    });
    startCall(matchId, false); // join existing call
  } else {
    const newMatch = await addDoc(matchRef, {
      matched: false,
      peer1: currentUser.uid,
      createdAt: serverTimestamp(),
    });
    startCall(newMatch.id, true); // create new call
  }
}

// ✅ Call setup
async function startCall(callId, isCaller) {
  callDoc = doc(db, "videoMatch", callId);
  const offerCandidates = collection(callDoc, "offerCandidates");
  const answerCandidates = collection(callDoc, "answerCandidates");

  peerConnection = new RTCPeerConnection(config);
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  localVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = event => {
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
  };

  peerConnection.onicecandidate = async event => {
    if (event.candidate) {
      await addDoc(isCaller ? offerCandidates : answerCandidates, event.candidate.toJSON());
    }
  };

  if (isCaller) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await updateDoc(callDoc, { offer: offer });

    onSnapshot(callDoc, async snapshot => {
      const data = snapshot.data();
      if (data?.answer && !peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });
  } else {
    onSnapshot(callDoc, async snapshot => {
      const data = snapshot.data();
      if (data?.offer && !peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await updateDoc(callDoc, { answer: answer });
      }
    });
  }

  onSnapshot(isCaller ? answerCandidates : offerCandidates, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        peerConnection.addIceCandidate(candidate);
      }
    });
  });
}

// ✅ End Call Functionality
function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
  }

  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
  }

  if (callDoc) {
    updateDoc(callDoc, { ended: true }).catch(console.warn);
  }

  alert("Call ended");
  window.location.href = "home.html"; // optional redirect
}

if (endCallBtn) {
  endCallBtn.onclick = endCall;
}

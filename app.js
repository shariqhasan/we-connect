// ✅ app.js (ES module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc,
  onSnapshot, addDoc, query, orderBy
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

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  iceCandidatePoolSize: 10,
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let roomId = null;

// ✅ UI Bindings
window.addEventListener('DOMContentLoaded', () => {
  const cameraBtn = document.getElementById('cameraBtn');
  const createBtn = document.getElementById('createBtn');
  const joinBtn = document.getElementById('joinBtn');
  const hangupBtn = document.getElementById('hangupBtn');
  const sendBtn = document.getElementById('sendMsgBtn');
  const chatInput = document.getElementById('chat-input');
  const chatBox = document.getElementById('chat-messages');

  const roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));

  cameraBtn.onclick = openUserMedia;
  createBtn.onclick = createRoom;
  joinBtn.onclick = () => roomDialog.open();
  document.getElementById('confirmJoinBtn').onclick = () => {
    const inputRoomId = document.getElementById('room-id').value.trim();
    if (!inputRoomId) return alert("Enter valid Room ID");
    roomId = inputRoomId;
    document.getElementById('room-id-display').textContent = roomId;
    joinRoomById(roomId);
  };
  hangupBtn.onclick = hangUp;

  // ✅ Send Message
  sendBtn.onclick = async () => {
    const text = chatInput.value.trim();
    if (!text || !roomId) return;
    const messagesRef = collection(db, `rooms/${roomId}/messages`);
    await addDoc(messagesRef, {
      message: text,
      timestamp: Date.now()
    });
    chatInput.value = "";
  };

  // ✅ Auto join from home.html redirect
  const urlParams = new URLSearchParams(window.location.search);
  const autoRoomId = urlParams.get('room');
  if (autoRoomId) {
    openUserMedia().then(() => {
      roomId = autoRoomId;
      document.getElementById('room-id-display').textContent = roomId;
      joinRoomById(roomId);
    });
  }
});

// ✅ Display Chat Messages
function listenToChatMessages(roomId) {
  const messagesRef = collection(db, `rooms/${roomId}/messages`);
  const chatBox = document.getElementById('chat-messages');
  const q = query(messagesRef, orderBy("timestamp"));
  onSnapshot(q, (snapshot) => {
    chatBox.innerHTML = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      const p = document.createElement("p");
      p.textContent = data.message;
      p.style.margin = "5px 0";
      chatBox.appendChild(p);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

// ✅ Camera/Mic
async function openUserMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  document.getElementById('localVideo').srcObject = localStream;
  document.getElementById('remoteVideo').srcObject = remoteStream;

  document.getElementById('cameraBtn').disabled = true;
  document.getElementById('createBtn').disabled = false;
  document.getElementById('joinBtn').disabled = false;
  document.getElementById('hangupBtn').disabled = false;
}

// ✅ Create Room
async function createRoom() {
  peerConnection = new RTCPeerConnection(config);
  registerPeerListeners();

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  const roomRef = doc(collection(db, 'rooms'));
  roomId = roomRef.id;
  document.getElementById('room-id-display').textContent = roomId;
  listenToChatMessages(roomId);

  const callerCandidates = collection(roomRef, 'callerCandidates');

  peerConnection.onicecandidate = async event => {
    if (event.candidate) {
      await addDoc(callerCandidates, event.candidate.toJSON());
    }
  };

  peerConnection.ontrack = event => {
    event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  await setDoc(roomRef, {
    offer: { type: offer.type, sdp: offer.sdp }
  });

  onSnapshot(roomRef, async snapshot => {
    const data = snapshot.data();
    if (!peerConnection.currentRemoteDescription && data?.answer) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  });

  const calleeCandidates = collection(roomRef, 'calleeCandidates');
  onSnapshot(calleeCandidates, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        peerConnection.addIceCandidate(candidate);
      }
    });
  });
}

// ✅ Join Room
async function joinRoomById(roomId) {
  const roomRef = doc(db, 'rooms', roomId);
  const roomSnapshot = await getDoc(roomRef);
  if (!roomSnapshot.exists()) return alert("❌ Room not found");

  peerConnection = new RTCPeerConnection(config);
  registerPeerListeners();

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  listenToChatMessages(roomId);

  const calleeCandidates = collection(roomRef, 'calleeCandidates');
  peerConnection.onicecandidate = async event => {
    if (event.candidate) {
      await addDoc(calleeCandidates, event.candidate.toJSON());
    }
  };

  peerConnection.ontrack = event => {
    event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
  };

  const offer = roomSnapshot.data().offer;
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  await updateDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } });

  const callerCandidates = collection(roomRef, 'callerCandidates');
  onSnapshot(callerCandidates, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });
}

// ✅ Hang Up
async function hangUp() {
  if (peerConnection) peerConnection.close();
  localStream?.getTracks().forEach(track => track.stop());

  document.getElementById('localVideo').srcObject = null;
  document.getElementById('remoteVideo').srcObject = null;

  document.getElementById('cameraBtn').disabled = false;
  document.getElementById('createBtn').disabled = true;
  document.getElementById('joinBtn').disabled = true;
  document.getElementById('hangupBtn').disabled = true;
  document.getElementById('room-id-display').textContent = 'None';

  if (roomId) {
    await deleteDoc(doc(db, 'rooms', roomId));
  }

  location.reload();
}

// ✅ Debug Logs
function registerPeerListeners() {
  peerConnection.onicegatheringstatechange = () => console.log(`ICE Gathering: ${peerConnection.iceGatheringState}`);
  peerConnection.onconnectionstatechange = () => console.log(`Connection: ${peerConnection.connectionState}`);
  peerConnection.onsignalingstatechange = () => console.log(`Signaling: ${peerConnection.signalingState}`);
  peerConnection.oniceconnectionstatechange = () => console.log(`ICE Connection: ${peerConnection.iceConnectionState}`);
}


const socket = io();
let role = null, room = null, name = null;
let peers = {}; 
let localStream = null;
let recording = false;
let recorder = null;
let muted = false;

const roomEl = document.getElementById('room');
const pinEl = document.getElementById('pin');
const nameEl = document.getElementById('name');
const statusEl = document.getElementById('status');
const djBtn = document.getElementById('djBtn');
const listenerBtn = document.getElementById('listenerBtn');
const leaveBtn = document.getElementById('leaveBtn');
const micBtn = document.getElementById('micBtn');
const sysBtn = document.getElementById('sysBtn');
const muteBtn = document.getElementById('muteBtn');
const recordBtn = document.getElementById('recordBtn');
const djControls = document.getElementById('djControls');
const player = document.getElementById('player');
const chatbox = document.getElementById('chatbox');
const chatInput = document.getElementById('chatInput');
const sendChat = document.getElementById('sendChat');
const vol = document.getElementById('vol');

function setStatus(t){ statusEl.textContent = t; }
function addChat(n,t){ const el=document.createElement('div'); el.innerHTML = `<b>${n}:</b> ${t}`; chatbox.appendChild(el); chatbox.scrollTop = chatbox.scrollHeight; }

function rtcConfig(){ return { iceServers: [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80", username:"openrelayproject", credential:"openrelayproject" }
] }; }

async function djConnectTo(listenerId){
  if (!localStream) { setStatus("Pick mic or system audio first."); return; }
  const pc = new RTCPeerConnection(rtcConfig());
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  pc.onicecandidate = e => { if (e.candidate) socket.emit('ice-candidate', { targetId: listenerId, candidate: e.candidate }); };
  peers[listenerId] = pc;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('offer', { targetId: listenerId, sdp: offer });
}

async function listenerHandleOffer(fromId, sdp){
  const pc = new RTCPeerConnection(rtcConfig());
  peers['dj'] = pc;
  pc.onicecandidate = e => { if (e.candidate) socket.emit('ice-candidate', { targetId: fromId, candidate: e.candidate }); };
  pc.ontrack = e => {
    const [stream] = e.streams;
    player.srcObject = stream;
    player.play().catch(()=>{});
  };
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', { targetId: fromId, sdp: answer });
}

socket.on('offer', async ({ fromId, sdp }) => { if (role==='listener') await listenerHandleOffer(fromId, sdp); });
socket.on('answer', async ({ fromId, sdp }) => { const pc = peers[fromId]; if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp)); });
socket.on('ice-candidate', async ({ fromId, candidate }) => { const key = role==='dj' ? fromId : 'dj'; const pc = peers[key]; if (pc && candidate) { try{ await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e){} } });

socket.on('listener-joined', ({ listenerId, name }) => { if (role==='dj') { setStatus(`Listener joined: ${listenerId}`); djConnectTo(listenerId); } });
socket.on('listener-left', ({ listenerId }) => { if (role==='dj') { const pc = peers[listenerId]; if (pc) pc.close(); delete peers[listenerId]; } });
socket.on('status', (msg) => { if (msg.type==='dj-online') setStatus('DJ is online.'); if (msg.type==='dj-offline') setStatus('DJ went offline.'); });
socket.on('roster', ({ djId, listeners }) => {});
socket.on('chat', ({ name, text }) => addChat(name, text));
socket.on('join-failed', ({ reason }) => alert('Join failed: '+reason));
socket.on('join-success', ({ room, djId }) => { setStatus('Joined '+room); });

sendChat.onclick = () => { const t = chatInput.value.trim(); if (!t||!room) return; socket.emit('chat', { room, name: name||'Anon', text: t }); chatInput.value=''; }

function canShareSystemAudio(){ const ua=navigator.userAgent.toLowerCase(); const isAndroid=ua.includes('android'); const isChrome=ua.includes('chrome'); return !isAndroid && isChrome && !!navigator.mediaDevices.getDisplayMedia; }

djBtn.onclick = async () => {
  room = roomEl.value.trim(); if (!room) { alert('Enter room'); return; }
  name = nameEl.value.trim(); role='dj';
  socket.emit('joinRoom', { room, role, name, pin: pinEl.value.trim() });
  setStatus('Joined as DJ. Choose mic or system audio.');
  djControls.style.display='block'; djBtn.disabled=true; listenerBtn.disabled=true; leaveBtn.disabled=false;
  sysBtn.disabled = !canShareSystemAudio();
  recordBtn.disabled = false;
};

listenerBtn.onclick = () => {
  room = roomEl.value.trim(); if (!room) { alert('Enter room'); return; }
  name = nameEl.value.trim(); role='listener';
  socket.emit('joinRoom', { room, role, name, pin: pinEl.value.trim() });
  setStatus('Joined as Listener. Waiting for DJ...');
  djControls.style.display='none'; djBtn.disabled=true; listenerBtn.disabled=true; leaveBtn.disabled=false;
};

leaveBtn.onclick = () => { socket.emit('leaveRoom'); location.reload(); };

micBtn.onclick = async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio:true });
    localStream.getAudioTracks().forEach(t=>t.enabled=true);
    setStatus('Mic live. New listeners will hear you.');
    muteBtn.disabled=false;
    for (const id in peers){ try{ peers[id].close(); }catch(e){} delete peers[id]; }
  } catch(e){ alert('Mic permission required'); }
};

sysBtn.onclick = async () => {
  if (!canShareSystemAudio()) { alert('System audio only on desktop Chrome'); return; }
  try {
    const ds = await navigator.mediaDevices.getDisplayMedia({ audio:true, video:true });
    const audioTracks = ds.getAudioTracks();
    if (audioTracks.length===0){ alert('No system audio captured. Share a tab with audio.'); ds.getTracks().forEach(t=>t.stop()); return; }
    localStream = new MediaStream([audioTracks[0]]);
    ds.getVideoTracks().forEach(t=>t.stop());
    setStatus('System audio live. Play YouTube in that tab.');
    muteBtn.disabled=false;
    for (const id in peers){ try{ peers[id].close(); }catch(e){} delete peers[id]; }
  } catch(e){ alert('Share failed or denied'); }
};

muteBtn.onclick = () => { if (!localStream) return; muted = !muted; localStream.getAudioTracks().forEach(t=>t.enabled=!muted); muteBtn.textContent = muted ? 'Unmute' : 'Mute'; };

recordBtn.onclick = async () => {
  if (recording) {
    recorder.stop();
    socket.emit('record-stop', { room });
    recordBtn.textContent = 'Start Recording';
    recording = false;
    return;
  }
  if (!localStream) { alert('Start mic or system audio first'); return; }
  recorder = new MediaRecorder(localStream, { mimeType: 'audio/webm;codecs=opus' });
  recorder.ondataavailable = async (e) => {
    if (e.data && e.data.size > 0) {
      const ab = await e.data.arrayBuffer();
      socket.emit('record-chunk', { room, buffer: ab });
    }
  };
  recorder.onstop = () => { console.log('recorder stopped'); };
  socket.emit('record-start', { room });
  recorder.start(1000);
  recordBtn.textContent = 'Stop Recording';
  recording = true;
};

vol.addEventListener('input', () => { player.volume = parseFloat(vol.value); });

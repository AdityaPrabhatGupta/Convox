const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

let peerConnection = null;
let localStream = null;
let pendingCandidates = [];
let remoteDescSet = false;
let onIceCandidate = null;
let onRemoteTrack = null;
let onConnectionStateChange = null;

export async function getLocalStream(callType = "video") {
  if (localStream) {
    const allLive = localStream.getTracks().every((track) => track.readyState === "live");
    if (allLive) return localStream;
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  const constraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100,
    },
    video:
      callType === "video"
        ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
        : false,
  };

  try {
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    return localStream;
  } catch (err) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      throw new Error(
        "Camera/microphone access was denied. Please allow permissions in your browser settings and try again.",
      );
    }
    if (err.name === "NotFoundError") {
      throw new Error("No camera or microphone was found. Please connect a device and try again.");
    }
    if (err.name === "NotReadableError") {
      throw new Error("Your camera or microphone is already in use by another application.");
    }
    throw new Error(`Could not access media devices: ${err.message}`);
  }
}

export function stopLocalStream() {
  if (!localStream) return;
  localStream.getTracks().forEach((track) => track.stop());
  localStream = null;
}

export function createPeer(callbacks = {}) {
  destroyPeer();

  onIceCandidate = callbacks.onIceCandidate ?? null;
  onRemoteTrack = callbacks.onRemoteTrack ?? null;
  onConnectionStateChange = callbacks.onConnectionStateChange ?? null;

  peerConnection = new RTCPeerConnection(ICE_SERVERS);
  pendingCandidates = [];
  remoteDescSet = false;

  if (localStream) {
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
  }

  const remoteStreamFallback = new MediaStream();
  peerConnection.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      if (onRemoteTrack) onRemoteTrack(event.streams[0]);
      return;
    }
    remoteStreamFallback.addTrack(event.track);
    if (onRemoteTrack) onRemoteTrack(remoteStreamFallback);
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate && onIceCandidate) {
      onIceCandidate(event.candidate);
    }
  };

  peerConnection._iceRestartTimer = null;
  peerConnection.onicegatheringstatechange = () => {
    if (peerConnection?.iceGatheringState === "gathering") {
      peerConnection._iceRestartTimer = setTimeout(() => {
        if (
          peerConnection &&
          peerConnection.signalingState !== "closed" &&
          peerConnection.iceConnectionState !== "connected" &&
          peerConnection.iceConnectionState !== "completed"
        ) {
          try {
            peerConnection.restartIce();
          } catch {
            // Ignore restart failures while the connection is shutting down.
          }
        }
        if (peerConnection) peerConnection._iceRestartTimer = null;
      }, 8000);
    } else {
      clearTimeout(peerConnection?._iceRestartTimer);
      if (peerConnection) peerConnection._iceRestartTimer = null;
    }
  };

  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection?.connectionState;
    if (onConnectionStateChange) onConnectionStateChange(state);
  };

  return peerConnection;
}

export async function createOffer() {
  if (!peerConnection) throw new Error("Peer connection not initialized.");
  const offer = await peerConnection.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  });
  await peerConnection.setLocalDescription(offer);
  return offer;
}

export async function createAnswer() {
  if (!peerConnection) throw new Error("Peer connection not initialized.");
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  return answer;
}

export async function setRemoteDescription(sdp) {
  if (!peerConnection) throw new Error("Peer connection not initialized.");

  await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
  remoteDescSet = true;

  if (pendingCandidates.length) {
    for (const candidate of pendingCandidates) {
      if (!candidate) continue;
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore stale ICE candidates that arrive during teardown/reconnect.
      }
    }
    pendingCandidates = [];
  }
}

export async function addIceCandidate(candidate) {
  if (!peerConnection || !candidate) return;

  if (!remoteDescSet) {
    pendingCandidates.push(candidate);
    return;
  }

  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch {
    // Ignore stale ICE candidates that can race with connection shutdown.
  }
}

export function setAudioMuted(muted) {
  if (!localStream) return;
  localStream.getAudioTracks().forEach((track) => {
    track.enabled = !muted;
  });
}

export function setVideoEnabled(enabled) {
  if (!localStream) return;
  localStream.getVideoTracks().forEach((track) => {
    track.enabled = enabled;
  });
}

export function destroyPeer() {
  if (peerConnection) {
    clearTimeout(peerConnection._iceRestartTimer);
    peerConnection.ontrack = null;
    peerConnection.onicecandidate = null;
    peerConnection.onconnectionstatechange = null;
    peerConnection.onicegatheringstatechange = null;
    peerConnection.close();
    peerConnection = null;
  }

  pendingCandidates = [];
  remoteDescSet = false;
  onIceCandidate = null;
  onRemoteTrack = null;
  onConnectionStateChange = null;
}

import { useCallback, useEffect, useRef, useState } from "react";
import {
  emitCallUser,
  emitAcceptCall,
  emitRejectCall,
  emitEndCall,
  emitIceCandidate,
  onIncomingCall,
  onCallAccepted,
  onCallRejected,
  onCallEnded,
  onIceCandidate as onRemoteIceCandidate,
  onCallError,
} from "../services/callSocketService.js";
import { socket } from "../../../services/socket.js";
import {
  getLocalStream,
  stopLocalStream,
  createPeer,
  destroyPeer,
  createOffer,
  createAnswer,
  setRemoteDescription,
  addIceCandidate,
  setAudioMuted,
  setVideoEnabled,
} from "../services/webrtcService.js";

export const CALL_STATUS = {
  IDLE: "idle",
  CALLING: "calling",
  RINGING: "ringing",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  ENDED: "ended",
};

export default function useCall({ currentUserId, currentUserName }) {
  const [callStatus, setCallStatus] = useState(CALL_STATUS.IDLE);
  const [callType, setCallType] = useState("video");
  const [remoteUser, setRemoteUser] = useState(null);
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [callError, setCallError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callLockRef = useRef(false);
  const remoteUserRef = useRef(null);
  const endedTimerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  useEffect(() => {
    remoteUserRef.current = remoteUser;
  }, [remoteUser]);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (!timerRef.current) return;
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const attachMediaStream = useCallback((videoRef, stream) => {
    if (!videoRef.current) return;
    if (videoRef.current.srcObject === stream) return;
    videoRef.current.srcObject = stream;
  }, []);

  const teardown = useCallback((finalStatus = CALL_STATUS.ENDED, options = {}) => {
    const { preserveError = false } = options;
    callLockRef.current = false;
    stopTimer();
    destroyPeer();
    stopLocalStream();
    localStreamRef.current = null;
    remoteStreamRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    setCallStatus(finalStatus);
    setCallDuration(0);
    if (finalStatus !== CALL_STATUS.ENDED) {
      setRemoteUser(null);
    }
    setIncomingCallData(null);
    setIsMuted(false);
    setIsVideoOff(false);

    if (finalStatus === CALL_STATUS.ENDED) {
      clearTimeout(endedTimerRef.current);
      endedTimerRef.current = setTimeout(() => {
        setCallStatus(CALL_STATUS.IDLE);
        setRemoteUser(null);
        setCallError("");
      }, 2800);
    } else {
      clearTimeout(endedTimerRef.current);
      if (!preserveError) {
        setCallError("");
      }
    }
  }, [stopTimer]);

  const handleRemoteTrack = useCallback((stream) => {
    remoteStreamRef.current = stream;
    attachMediaStream(remoteVideoRef, stream);
  }, [attachMediaStream]);

  const ensureRealtimeConnected = useCallback(() => {
    if (socket.connected) return true;
    setCallError("Realtime server is offline. Start the backend and try the call again.");
    return false;
  }, []);

  const startCall = useCallback(async ({ targetUserId, targetUserName, type = "video" }) => {
    if (callLockRef.current) return;
    const safeToCall =
      callStatus === CALL_STATUS.IDLE || callStatus === CALL_STATUS.ENDED;
    if (!safeToCall) return;
    if (!ensureRealtimeConnected()) return;

    callLockRef.current = true;
    setCallError("");

    try {
      setCallType(type);
      setRemoteUser({ id: targetUserId, name: targetUserName });
      setCallStatus(CALL_STATUS.CALLING);

      const stream = await getLocalStream(type);
      localStreamRef.current = stream;
      attachMediaStream(localVideoRef, stream);

      await createPeer({
        onIceCandidate: (candidate) => {
          emitIceCandidate({ targetUserId, candidate });
        },
        onRemoteTrack: handleRemoteTrack,
        onConnectionStateChange: (state) => {
          if (state === "connected") {
            setCallStatus(CALL_STATUS.CONNECTED);
            startTimer();
          } else if (state === "failed") {
            setCallError("Connection lost. The call has ended.");
            teardown();
          } else if (state === "disconnected") {
            setCallStatus(CALL_STATUS.CONNECTING);
          }
        },
      });

      const offer = await createOffer();
      emitCallUser({
        targetUserId,
        callerId: currentUserId,
        callerName: currentUserName || "Someone",
        offer,
        callType: type,
      });
    } catch (err) {
      setCallError(err.message || "Could not start the call.");
      teardown(CALL_STATUS.ENDED, { preserveError: true });
    }
  }, [attachMediaStream, callStatus, currentUserId, currentUserName, ensureRealtimeConnected, handleRemoteTrack, startTimer, teardown]);

  const acceptCall = useCallback(async () => {
    if (!incomingCallData || callLockRef.current) return;
    if (!ensureRealtimeConnected()) {
      setIncomingCallData(null);
      setCallStatus(CALL_STATUS.IDLE);
      return;
    }
    callLockRef.current = true;
    setCallError("");

    const { offer, callerId, callerName, callType: incomingType } = incomingCallData;

    try {
      setCallType(incomingType);
      setRemoteUser({ id: callerId, name: callerName });
      setCallStatus(CALL_STATUS.CONNECTING);
      setIncomingCallData(null);

      const stream = await getLocalStream(incomingType);
      localStreamRef.current = stream;
      attachMediaStream(localVideoRef, stream);

      await createPeer({
        onIceCandidate: (candidate) => {
          emitIceCandidate({ targetUserId: callerId, candidate });
        },
        onRemoteTrack: handleRemoteTrack,
        onConnectionStateChange: (state) => {
          if (state === "connected") {
            setCallStatus(CALL_STATUS.CONNECTED);
            startTimer();
          } else if (state === "failed") {
            setCallError("Connection lost. The call has ended.");
            teardown();
          } else if (state === "disconnected") {
            setCallStatus(CALL_STATUS.CONNECTING);
          }
        },
      });

      await setRemoteDescription(offer);
      const answer = await createAnswer();
      emitAcceptCall({ callerId, answer });
    } catch (err) {
      setCallError(err.message || "Could not accept the call.");
      teardown(CALL_STATUS.ENDED, { preserveError: true });
    }
  }, [attachMediaStream, ensureRealtimeConnected, incomingCallData, handleRemoteTrack, startTimer, teardown]);

  const rejectCall = useCallback(() => {
    if (!incomingCallData) return;
    emitRejectCall(incomingCallData.callerId);
    setIncomingCallData(null);
    setCallError("");
    setCallStatus(CALL_STATUS.IDLE);
  }, [incomingCallData]);

  const endCall = useCallback(() => {
    const peer = remoteUserRef.current;
    if (peer?.id) {
      emitEndCall(peer.id);
    }
    teardown();
  }, [teardown]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    setAudioMuted(next);
    setIsMuted(next);
  }, [isMuted]);

  const toggleVideo = useCallback(() => {
    const next = !isVideoOff;
    setVideoEnabled(!next);
    setIsVideoOff(next);
  }, [isVideoOff]);

  useEffect(() => {
    attachMediaStream(localVideoRef, localStreamRef.current);
    attachMediaStream(remoteVideoRef, remoteStreamRef.current);
  }, [attachMediaStream, callStatus, callType, remoteUser]);

  useEffect(() => {
    const unsubIncoming = onIncomingCall((data) => {
      if (callLockRef.current) {
        emitRejectCall(data.callerId);
        return;
      }
      setIncomingCallData(data);
      setCallStatus(CALL_STATUS.RINGING);
    });

    const unsubAccepted = onCallAccepted(async ({ answer }) => {
      try {
        setCallStatus(CALL_STATUS.CONNECTING);
        await setRemoteDescription(answer);
      } catch {
        setCallError("Failed to establish call. Please try again.");
        teardown();
      }
    });

    const unsubRejected = onCallRejected(({ reason }) => {
      // FIX: Handle all rejection reasons with a clear message.
      // Use ENDED (not IDLE) so the 2s banner shows — previously the screen
      // vanished instantly because IDLE skips the banner timeout entirely.
      if (reason === "offline") {
        setCallError("That user is not online right now.");
      } else if (reason === "busy") {
        setCallError("That user is already in another call.");
      } else {
        setCallError("Call was declined.");
      }
      teardown(CALL_STATUS.ENDED, { preserveError: true });
    });

    const unsubEnded = onCallEnded(() => {
      if (callLockRef.current === false && callStatus === CALL_STATUS.IDLE) {
        return;
      }
      teardown(CALL_STATUS.ENDED);
    });

    const unsubIce = onRemoteIceCandidate(async ({ candidate }) => {
      try {
        await addIceCandidate(candidate);
      } catch {
        // Ignore late ICE candidates after a call has already torn down.
      }
    });

    const unsubError = onCallError(({ message }) => {
      setCallError(message || "An error occurred during the call.");
      teardown(CALL_STATUS.ENDED, { preserveError: true });
    });

    return () => {
      unsubIncoming();
      unsubAccepted();
      unsubRejected();
      unsubEnded();
      unsubIce();
      unsubError();
    };
  }, [callStatus, teardown]);

  useEffect(() => {
    return () => {
      stopTimer();
      clearTimeout(endedTimerRef.current);
      destroyPeer();
      stopLocalStream();
    };
  }, [stopTimer]);

  return {
    callStatus,
    callType,
    remoteUser,
    incomingCallData,
    callError,
    isMuted,
    isVideoOff,
    callDuration,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    setCallError,
  };
}

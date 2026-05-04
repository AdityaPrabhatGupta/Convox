import { socket } from "../../../services/socket.js";

export function emitCallUser({
  targetUserId,
  callerId,
  callerName,
  offer,
  callType = "video",
}) {
  socket.emit("call-user", {
    targetUserId,
    callerId,
    callerName,
    offer,
    callType,
  });
}

export function emitAcceptCall({ callerId, answer }) {
  socket.emit("accept-call", { callerId, answer });
}

export function emitRejectCall(callerId) {
  socket.emit("reject-call", { callerId });
}

export function emitEndCall(targetUserId) {
  socket.emit("end-call", { targetUserId });
}

export function emitIceCandidate({ targetUserId, candidate }) {
  socket.emit("ice-candidate", { targetUserId, candidate });
}

export function onIncomingCall(handler) {
  socket.on("incoming-call", handler);
  return () => socket.off("incoming-call", handler);
}

export function onCallAccepted(handler) {
  socket.on("call-accepted", handler);
  return () => socket.off("call-accepted", handler);
}

export function onCallRejected(handler) {
  socket.on("call-rejected", handler);
  return () => socket.off("call-rejected", handler);
}

export function onCallEnded(handler) {
  socket.on("call-ended", handler);
  return () => socket.off("call-ended", handler);
}

export function onIceCandidate(handler) {
  socket.on("ice-candidate", handler);
  return () => socket.off("ice-candidate", handler);
}

export function onCallError(handler) {
  socket.on("call-error", handler);
  return () => socket.off("call-error", handler);
}

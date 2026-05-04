const activeCallPairs = new Map();

/**
 * Register a call pair. Stores callType so it can be retrieved on end-call
 * to produce an accurate call log. startedAt is set when status → connected.
 */
export function registerCallPair(userA, userB, status = "ringing", callType = "audio") {
  const base = { peerId: String(userB), status, callType, startedAt: null };
  const baseB = { peerId: String(userA), status, callType, startedAt: null };
  activeCallPairs.set(String(userA), base);
  activeCallPairs.set(String(userB), baseB);
}

export function getCallState(userId) {
  return activeCallPairs.get(String(userId)) ?? null;
}

export function updateCallPairStatus(userId, status) {
  const current = getCallState(userId);
  if (!current?.peerId) return;

  const startedAt = status === "connected" ? Date.now() : (current.startedAt ?? null);

  activeCallPairs.set(String(userId), {
    peerId: current.peerId,
    status,
    callType: current.callType,
    startedAt,
  });
  activeCallPairs.set(String(current.peerId), {
    peerId: String(userId),
    status,
    callType: current.callType,
    startedAt,
  });
}

export function removeCallPair(userId) {
  const normalizedUserId = String(userId);
  const state = getCallState(normalizedUserId);
  const peerId = state?.peerId;

  if (peerId) {
    activeCallPairs.delete(String(peerId));
  }

  activeCallPairs.delete(normalizedUserId);
  return peerId;
}

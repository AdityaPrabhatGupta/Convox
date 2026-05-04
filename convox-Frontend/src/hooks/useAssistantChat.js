import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchChatSummary,
  fetchSmartReplies,
  getAssistantStatus,
} from "../services/aiService.js";

const SMART_REPLY_DEBOUNCE_MS = 1200;

function formatCountdown(ms) {
  if (ms <= 0) return "now";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

export default function useAssistantChat({ chatId, isBot, messages }) {
  const [status, setStatus] = useState({
    messagesRemaining: 10,
    limitReached: false,
    warnUser: false,
    refreshesAt: null,
  });
  const [countdown, setCountdown] = useState("");
  const [smartReplies, setSmartReplies] = useState([]);
  const [loadingSmartReplies, setLoadingSmartReplies] = useState(false);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const smartReplyTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  useEffect(() => {
    if (!isBot || !chatId) return;

    getAssistantStatus(chatId)
      .then((data) => {
        setStatus({
          messagesRemaining: data.messagesRemaining ?? 10,
          limitReached: data.limitReached ?? false,
          warnUser: data.warnUser ?? false,
          refreshesAt: data.refreshesAt ?? null,
        });
      })
      .catch(() => {});
  }, [isBot, chatId]);

  useEffect(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (!status.limitReached || !status.refreshesAt) {
      setCountdown("");
      return;
    }

    const tick = () => {
      const ms = status.refreshesAt - Date.now();

      if (ms <= 0) {
        setCountdown("now");
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setStatus((previous) => ({
          ...previous,
          messagesRemaining: 10,
          limitReached: false,
          warnUser: false,
          refreshesAt: null,
        }));
        return;
      }

      setCountdown(formatCountdown(ms));
    };

    tick();
    countdownIntervalRef.current = setInterval(tick, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [status.limitReached, status.refreshesAt]);

  useEffect(() => {
    if (!chatId || !messages?.length) return;

    if (status.limitReached) {
      setSmartReplies([]);
      return;
    }

    if (smartReplyTimerRef.current) {
      clearTimeout(smartReplyTimerRef.current);
    }

    smartReplyTimerRef.current = setTimeout(async () => {
      setLoadingSmartReplies(true);
      try {
        const replies = await fetchSmartReplies(chatId);
        setSmartReplies(replies);
      } catch {
        setSmartReplies([]);
      } finally {
        setLoadingSmartReplies(false);
      }
    }, SMART_REPLY_DEBOUNCE_MS);

    return () => {
      if (smartReplyTimerRef.current) {
        clearTimeout(smartReplyTimerRef.current);
      }
    };
  }, [isBot, chatId, messages, status.limitReached]);

  const updateStatusFromResponse = useCallback((responseData) => {
    if (!responseData) return;

    setStatus({
      messagesRemaining: responseData.messagesRemaining ?? 0,
      limitReached: responseData.limitReached ?? false,
      warnUser: responseData.warnUser ?? false,
      refreshesAt: responseData.refreshesAt ?? null,
    });
  }, []);

  const setTyping = useCallback((value) => {
    setAssistantTyping(value);
  }, []);

  const requestSummary = useCallback(async () => {
    if (!chatId) return;

    setLoadingSummary(true);
    setSummary(null);

    try {
      const result = await fetchChatSummary(chatId);
      setSummary(result || "Nothing to summarize yet.");
    } catch {
      setSummary("Could not generate summary right now.");
    } finally {
      setLoadingSummary(false);
    }
  }, [chatId]);

  const clearSummary = useCallback(() => {
    setSummary(null);
  }, []);

  return {
    status,
    countdown,
    smartReplies,
    loadingSmartReplies,
    assistantTyping,
    summary,
    loadingSummary,
    setTyping,
    updateStatusFromResponse,
    requestSummary,
    clearSummary,
  };
}

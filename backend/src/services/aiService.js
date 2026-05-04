const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 8000;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const DEFAULT_MAX_TOKENS = 150;

async function callGroq(messages, maxTokens = DEFAULT_MAX_TOKENS) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.5,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("Empty response from Groq");
    }

    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

function buildContext(messages, limit = 15) {
  return messages
    .slice(-limit)
    .filter((message) => message.content && !message.isDeletedForEveryone)
    .map((message) => `${message.senderName || "User"}: ${message.content}`)
    .join("\n");
}

export async function getSmartReplies(messages) {
  try {
    const context = buildContext(messages, 8);
    if (!context) return [];

    const raw = await callGroq(
      [
        {
          role: "system",
          content:
            "You suggest exactly 3 short, natural reply options for a chat. Each reply must be under 12 words. Return only the 3 replies, one per line, with no numbering or extra text.",
        },
        {
          role: "user",
          content: `Conversation:\n${context}`,
        },
      ],
      120,
    );
    const replies = raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.length < 80)
      .slice(0, 3);

    return replies.length ? replies : [];
  } catch (error) {
    console.error("[aiService] smartReplies failed:", error.message);
    return [];
  }
}

export async function summarizeChat(messages) {
  try {
    const context = buildContext(messages, 25);
    if (!context) return null;

    const summary = await callGroq(
      [
        {
          role: "system",
          content:
            "Summarize chats in 3 to 5 concise sentences. Focus on the main topics and key decisions. Return only the summary.",
        },
        {
          role: "user",
          content: `Conversation:\n${context}`,
        },
      ],
      200,
    );
    return summary || null;
  } catch (error) {
    console.error("[aiService] summarizeChat failed:", error.message);
    return null;
  }
}

export async function contextualAnswer(query, messages) {
  try {
    const context = buildContext(messages, 15);
    const answer = await callGroq(
      [
        {
          role: "system",
          content:
            "You answer questions about a chat conversation. Be helpful, concise, and friendly. Keep the answer under 100 words.",
        },
        {
          role: "user",
          content: `${context ? `Recent conversation:\n${context}\n\n` : ""}User question: ${query}`,
        },
      ],
      180,
    );
    return answer || "I couldn't find a good answer for that.";
  } catch (error) {
    console.error("[aiService] contextualAnswer failed:", error.message);
    return "I couldn't process that right now. Please try again.";
  }
}

export async function getAssistantReply(userMessage) {
  try {
    const reply = await callGroq(
      [
        {
          role: "system",
          content:
            "You are Convox Assistant, a beginner-friendly onboarding bot for the Convox chat app. Reply in 1 to 3 short lines. Help users with app features like messaging, media sharing, voice notes, reactions, pinned messages, reply-to, forwarding, blocking, removing users, group chats, and profile settings. If the user asks about unrelated topics, gently redirect them back to Convox features. Never mention or reveal the underlying AI model or provider.",
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      150,
    );
    return reply || getAssistantFallback(userMessage);
  } catch (error) {
    console.error("[aiService] assistantReply failed:", error.message);
    return getAssistantFallback(userMessage);
  }
}

function getAssistantFallback(userMessage) {
  const lower = String(userMessage || "").toLowerCase();

  if (
    lower.includes("media") ||
    lower.includes("photo") ||
    lower.includes("image")
  ) {
    return "You can share photos, videos, and files from the attachment button inside any chat.";
  }

  if (
    lower.includes("voice") ||
    lower.includes("audio") ||
    lower.includes("record")
  ) {
    return "Use the mic button in a regular chat to record and send a voice note quickly.";
  }

  if (lower.includes("block") || lower.includes("remove")) {
    return "Open a chat, use the top-right menu, and choose Block User or Remove Friend when needed.";
  }

  if (lower.includes("group")) {
    return "Group chats let you talk with multiple people together and keep the conversation in one place.";
  }

  return "I'm here to help you explore Convox. Ask me about messaging, media sharing, voice notes, or other app features.";
}

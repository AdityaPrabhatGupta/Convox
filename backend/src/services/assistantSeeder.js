import { Chat, Message, User } from "../models/index.js";
import logger from "../config/logger.js";

const ASSISTANT_EMAIL = "assistant@convox.app";
const WELCOME_MESSAGE = `Hey 👋 I’m your Convox Assistant.

Let’s get you started quickly - try one of these:

👉 "How do I send a message?"

👉 "Show me how to upload an image"

👉 "How do I find friends?"

Or just type anything - I’ve got you.`;

let assistantUserId = null;

export function getAssistantUserId() {
  return assistantUserId;
}

export async function seedAssistantUser() {
  try {
    let bot = await User.findOne({ email: ASSISTANT_EMAIL });

    if (!bot) {
      const randomPassword = `Bot_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;

      bot = await User.create({
        name: "Convox Assistant",
        email: ASSISTANT_EMAIL,
        password: randomPassword,
        bio: "Your guide to Convox. Learn messaging, media sharing, and features instantly.",
        profilePic: process.env.ASSISTANT_AVATAR_URL || null,
        isBot: true,
      });
    } else if (!bot.isBot) {
      await User.updateOne({ _id: bot._id }, { $set: { isBot: true } });
      bot.isBot = true;
    }

    assistantUserId = bot._id;
    return bot;
  } catch (error) {
    logger.error("Failed to seed assistant user", { error: error.message });
    return null;
  }
}

async function resolveAssistantUserId() {
  if (assistantUserId) return assistantUserId;

  const bot = await User.findOne({
    email: ASSISTANT_EMAIL,
    isBot: true,
  }).select("_id");

  if (bot) {
    assistantUserId = bot._id;
    return assistantUserId;
  }

  const seeded = await seedAssistantUser();
  return seeded ? assistantUserId : null;
}

async function seedWelcomeMessage(chatId, botId) {
  const created = await Message.create({
    sender: botId,
    chat: chatId,
    content: WELCOME_MESSAGE,
    type: "text",
    isSystem: true,
  });

  await Chat.findByIdAndUpdate(chatId, { latestMessage: created._id });
  return created;
}

async function refreshUntouchedAssistantIntro(chatId, botId) {
  const messages = await Message.find({ chat: chatId }).sort({ createdAt: 1 });
  if (!messages.length) {
    await seedWelcomeMessage(chatId, botId);
    return;
  }

  const hasUserMessages = messages.some((message) => !message.isSystem);
  if (hasUserMessages) return;

  if (messages.length === 1 && messages[0].content === WELCOME_MESSAGE) return;

  await Message.deleteMany({ chat: chatId });
  await seedWelcomeMessage(chatId, botId);
}

export async function createOnboardingConversation(newUserId) {
  try {
    const botId = await resolveAssistantUserId();
    if (!botId) {
      logger.warn("Cannot create onboarding chat because assistant user is unavailable", {
        newUserId: String(newUserId),
      });
      return;
    }

    const existing = await Chat.findOne({
      isBotChat: true,
      users: { $all: [newUserId, botId] },
    });

    if (existing) {
      await refreshUntouchedAssistantIntro(existing._id, botId);
      return;
    }

    const chat = await Chat.create({
      isGroupChat: false,
      isBotChat: true,
      users: [newUserId, botId],
    });

    await seedWelcomeMessage(chat._id, botId);
  } catch (error) {
    logger.error("Failed to create onboarding conversation", {
      error: error.message,
      newUserId: String(newUserId),
    });
  }
}

export async function syncAssistantChatsForAllUsers() {
  try {
    const users = await User.find({ isBot: { $ne: true } }).select("_id");

    for (const user of users) {
      await createOnboardingConversation(user._id);
    }
  } catch (error) {
    logger.error("Failed to sync assistant chats", { error: error.message });
  }
}

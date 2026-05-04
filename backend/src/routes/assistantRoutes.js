import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  contextualAnswerHandler,
  getAssistantStatus,
  getSmartRepliesHandler,
  sendAssistantMessage,
  summarizeChatHandler,
} from "../controllers/assistantController.js";

const assistantRouter = express.Router();
const aiRouter = express.Router();

assistantRouter.post("/:chatId/message", protect, sendAssistantMessage);
assistantRouter.get("/:chatId/status", protect, getAssistantStatus);

aiRouter.post("/:chatId/smart-replies", protect, getSmartRepliesHandler);
aiRouter.post("/:chatId/summarize", protect, summarizeChatHandler);
aiRouter.post("/:chatId/ask", protect, contextualAnswerHandler);

export { assistantRouter, aiRouter };

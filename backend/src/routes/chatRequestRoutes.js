import express from "express";
import {
  sendChatRequest,
  getIncomingRequests,
  getOutgoingRequests,
  acceptChatRequest,
  rejectChatRequest,
  cancelChatRequest,
} from "../controllers/chatRequestController.js";
import { protect } from "../middleware/authMiddleware.js"; // your existing auth middleware

const router = express.Router();

// All routes are protected — must be logged in
router.use(protect);

router.post("/send", sendChatRequest);                      // POST   /api/chat-requests/send
router.get("/incoming", getIncomingRequests);               // GET    /api/chat-requests/incoming
router.get("/outgoing", getOutgoingRequests);               // GET    /api/chat-requests/outgoing
router.patch("/:requestId/accept", acceptChatRequest);      // PATCH  /api/chat-requests/:id/accept
router.patch("/:requestId/reject", rejectChatRequest);      // PATCH  /api/chat-requests/:id/reject
router.delete("/:requestId/cancel", cancelChatRequest);     // DELETE /api/chat-requests/:id/cancel

export default router;
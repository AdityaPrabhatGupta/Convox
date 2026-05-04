import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  createGroup,
  getGroup,
  renameGroup,
  addMembers,
  removeMember,
  leaveGroup,
  deleteGroup,
  transferAdmin,
} from "../controllers/groupController.js";

const router = express.Router();

router.post("/", protect, createGroup);
router.get("/:chatId", protect, getGroup);
router.patch("/:chatId/name", protect, renameGroup);
router.post("/:chatId/members", protect, addMembers);
router.delete("/:chatId/members/:memberId", protect, removeMember);
router.post("/:chatId/leave", protect, leaveGroup);
router.delete("/:chatId", protect, deleteGroup);
router.patch("/:chatId/admin", protect, transferAdmin);

export default router;

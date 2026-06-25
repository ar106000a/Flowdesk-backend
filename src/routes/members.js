import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  authorizeProject,
  requireOwner,
} from "../middleware/authorizeProject.js";
import {
  getMembers,
  addMember,
  updateMemberRole,
  removeMember,
} from "../controllers/members/memberController.js";

const router = Router({ mergeParams: true });
router.use(authenticate);
router.use(authorizeProject);

router.get("/", getMembers);
router.post("/", requireOwner, addMember);
router.patch("/:memberId", requireOwner, updateMemberRole);
router.delete("/:memberId", requireOwner, removeMember);

export default router;

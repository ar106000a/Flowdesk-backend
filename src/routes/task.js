import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeProject } from "../middleware/authorizeProject.js";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getTask,
} from "../controllers/task/taskController.js";
import commentRoutes from "./comment.js";
import timeRoutes from "./time.js";
import attachmentRoutes from "./attachments.js";

const router = Router({ mergeParams: true });
router.use(authenticate);
router.use(authorizeProject);

router.get("/", getTasks);
router.post("/", createTask);
router.patch("/:taskId", updateTask);
router.get("/:taskId", getTask);
router.delete("/:taskId", deleteTask);

router.use("/:taskId/comments", commentRoutes);
router.use("/:taskId/time", timeRoutes);
router.use("/:taskId/attachments", attachmentRoutes);

export default router;

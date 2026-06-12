import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeProject } from "../middleware/authorizeProject.js";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
} from "../controllers/task/taskController.js";
import commentRoutes from "./comment.js";
import timeRoutes from "./time.js";

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(authorizeProject);

router.get("/", getTasks);
router.post("/", createTask);
router.patch("/:taskId", updateTask);
router.delete("/:taskId", deleteTask);

// Nest comment routes under /:taskId/comments
// mergeParams on both routers ensures projectId and taskId are available
router.use("/:taskId/comments", commentRoutes);
router.use("/:taskId/time", timeRoutes);

export default router;

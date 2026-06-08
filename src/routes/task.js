import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeProject } from "../middleware/authorizeProject.js";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
} from "../controllers/task/taskController.js";

// mergeParams: true lets us access :projectId from the parent router
const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(authorizeProject);

router.get("/", getTasks);
router.post("/", createTask);
router.patch("/:taskId", updateTask);
router.delete("/:taskId", deleteTask);

export default router;

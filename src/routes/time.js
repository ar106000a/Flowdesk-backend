import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeProject } from "../middleware/authorizeProject.js";
import {
  getTimeLogs,
  logTime,
  deleteTimeLog,
} from "../controllers/time/timeController.js";

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(authorizeProject);

router.get("/", getTimeLogs);
router.post("/", logTime);
router.delete("/:timeLogId", deleteTimeLog);

export default router;

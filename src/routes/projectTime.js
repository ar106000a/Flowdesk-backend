import { Router } from "express";
import { getProjectTimeSummary } from "../controllers/time/timeController.js";

// mergeParams: true — projectId comes from the parent project router
// authenticate + authorizeProject already ran in project.js before this mounts
const router = Router({ mergeParams: true });

router.get("/", getProjectTimeSummary);

export default router;

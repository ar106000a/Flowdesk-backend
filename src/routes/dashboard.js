import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { getDashboard } from "../controllers/dashboard/dashboardController.js";

const router = Router();
router.use(authenticate);
router.get("/", getDashboard);

export default router;

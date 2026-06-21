import { Router } from "express";
import { getPortalData } from "../controllers/client/clientController.js";

// PUBLIC route — no authenticate middleware
// Mounted separately at /app/portal in index.js
const router = Router();

router.get("/:token", getPortalData);

export default router;

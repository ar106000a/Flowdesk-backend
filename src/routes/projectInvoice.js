import { Router } from "express";
import {
  getProjectInvoices,
  createInvoice,
} from "../controllers/invoice/invoiceController.js";

// mergeParams: true — projectId comes from the parent project router
// authenticate + authorizeProject already ran in project.js
const router = Router({ mergeParams: true });

router.get("/", getProjectInvoices);
router.post("/", createInvoice);

export default router;

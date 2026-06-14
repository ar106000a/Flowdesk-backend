import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  getInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
} from "../controllers/invoice/invoiceController.js";

const router = Router();

router.use(authenticate);

// Global — all invoices across user's projects
router.get("/", getInvoices);

// Single invoice — authorization checked inside controller
router.get("/:invoiceId", getInvoice);
router.patch("/:invoiceId", updateInvoice);
router.delete("/:invoiceId", deleteInvoice);

export default router;

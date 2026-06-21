import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  getInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
} from "../controllers/invoice/invoiceController.js";
import { generateInvoicePdf } from "../controllers/invoice/pdfController.js";
import {
  sendInvoice,
  markInvoicePaid,
  cancelInvoice,
} from "../controllers/invoice/invoiceActionsController.js";

const router = Router();
router.use(authenticate);

router.get("/", getInvoices);
router.get("/:invoiceId", getInvoice);
router.patch("/:invoiceId", updateInvoice);
router.delete("/:invoiceId", deleteInvoice);
router.post("/:invoiceId/pdf", generateInvoicePdf);
router.post("/:invoiceId/send", sendInvoice);
router.post("/:invoiceId/mark-paid", markInvoicePaid);
router.post("/:invoiceId/cancel", cancelInvoice);

export default router;

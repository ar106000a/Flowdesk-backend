import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeProject } from "../middleware/authorizeProject.js";
import {
  uploadAttachment,
  deleteAttachment,
} from "../controllers/upload/uploadController.js";

const router = Router({ mergeParams: true });
router.use(authenticate);
router.use(authorizeProject);

router.post("/", uploadAttachment);
router.delete("/:attachmentId", deleteAttachment);

export default router;

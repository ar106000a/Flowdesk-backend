import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import {
  generatePortalToken,
  revokePortalToken,
} from '../controllers/client/clientController.js'

// Owner-only actions — require auth
const router = Router({ mergeParams: true })

router.use(authenticate)
router.post('/generate', generatePortalToken)
router.post('/revoke',   revokePortalToken)

export default router
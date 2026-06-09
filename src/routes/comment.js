import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorizeProject } from '../middleware/authorizeProject.js'
import {
  getComments,
  createComment,
  deleteComment,
} from '../controllers/comment/commentController.js'

const router = Router({ mergeParams: true })

router.use(authenticate)
router.use(authorizeProject)

router.get('/',               getComments)
router.post('/',              createComment)
router.delete('/:commentId',  deleteComment)

export default router
import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorizeProject, requireOwner } from '../middleware/authorizeProject.js'
import {
  getProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
} from '../controllers/project/projectController.js'

const router = Router()

// All project routes require authentication
router.use(authenticate)

router.get('/',    getProjects)
router.post('/',   createProject)

// Routes below need project membership check
router.get('/:projectId',    authorizeProject, getProject)
router.patch('/:projectId',  authorizeProject, requireOwner, updateProject)
router.delete('/:projectId', authorizeProject, requireOwner, deleteProject)

export default router
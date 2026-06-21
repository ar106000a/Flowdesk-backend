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
import projectTimeRoutes from './projectTime.js'
import projectInvoiceRoutes from './projectInvoice.js'
import portalRoutes from './portal.js'

const router = Router()

router.use(authenticate)

router.get('/',    getProjects)
router.post('/',   createProject)

router.get('/:projectId',    authorizeProject, getProject)
router.patch('/:projectId',  authorizeProject, requireOwner, updateProject)
router.delete('/:projectId', authorizeProject, requireOwner, deleteProject)

router.use('/:projectId/time',     authorizeProject, projectTimeRoutes)
router.use('/:projectId/invoices', authorizeProject, projectInvoiceRoutes)
router.use('/:projectId/portal',   authorizeProject, requireOwner, portalRoutes)

export default router
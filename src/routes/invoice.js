import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { getInvoices, getInvoice, updateInvoice, deleteInvoice } from '../controllers/invoice/invoiceController.js'
import { generateInvoicePdf } from '../controllers/invoice/pdfController.js'

const router = Router()
router.use(authenticate)

router.get('/', getInvoices)
router.get('/:invoiceId', getInvoice)
router.patch('/:invoiceId', updateInvoice)
router.delete('/:invoiceId', deleteInvoice)
router.post('/:invoiceId/pdf', generateInvoicePdf)

export default router
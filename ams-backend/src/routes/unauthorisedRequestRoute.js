// src/routes/unauthorisedRequestRoute.js - submit and view unauthorised attendance requests
const express = require('express');
const router  = express.Router();

const unauthorisedRequestController = require('../controllers/unauthorisedRequestController');
const { verifyToken, authorize, authorizeOwnOrRoles } = require('../middleware/authMiddleware');
const { CAN_MANAGE_LEAVE } = require('../../config/roles');

// POST /unauthorised/submit - any authenticated employee can submit for themselves
router.post('/submit', verifyToken, unauthorisedRequestController.submitUnauthorisedRequest);

// GET /unauthorised/queue - assigned HOD/supervisor queue (preferred for Next.js proxy)
router.get(
    '/queue',
    verifyToken,
    authorize(...CAN_MANAGE_LEAVE),
    unauthorisedRequestController.getAllUnauthorisedRequests,
);

// GET /unauthorised - same as /queue (direct backend clients)
router.get('/', verifyToken, authorize(...CAN_MANAGE_LEAVE), unauthorisedRequestController.getAllUnauthorisedRequests);

// GET /unauthorised/employee/:employeeId - own history, or managers viewing others
router.get(
    '/employee/:employeeId',
    verifyToken,
    authorizeOwnOrRoles(...CAN_MANAGE_LEAVE),
    unauthorisedRequestController.getEmployeeUnauthorisedRequests,
);

// GET /unauthorised/me - unauthorised requests for the signed-in employee
// (must be before /:unauthorisedRequestId)
router.get('/me', verifyToken, unauthorisedRequestController.getMyUnauthorisedRequests);

// POST /unauthorised/:unauthorisedRequestId/approve|reject
router.post(
    '/:unauthorisedRequestId/approve',
    verifyToken,
    authorize(...CAN_MANAGE_LEAVE),
    (req, res) => {
        req.params.decision = 'approve';
        return unauthorisedRequestController.reviewUnauthorisedRequest(req, res);
    },
);
router.post(
    '/:unauthorisedRequestId/reject',
    verifyToken,
    authorize(...CAN_MANAGE_LEAVE),
    (req, res) => {
        req.params.decision = 'reject';
        return unauthorisedRequestController.reviewUnauthorisedRequest(req, res);
    },
);

// GET /unauthorised/:unauthorisedRequestId - single request for assigned admins
router.get(
    '/:unauthorisedRequestId',
    verifyToken,
    authorize(...CAN_MANAGE_LEAVE),
    unauthorisedRequestController.getUnauthorisedRequestById,
);

module.exports = router;

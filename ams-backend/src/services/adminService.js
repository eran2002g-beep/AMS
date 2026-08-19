// src/services/adminService.js - handles administrative actions on leave requests
// Delegates the core review logic to the underlying leaveRequestService.

const leaveRequestService = require('./leaveRequestService');
const unauthorisedRequestService = require('./unauthorisedRequestService');

class AdminService {
    /**
     * Approves a pending leave request.
     * 
     * @param {string} leaveRequestId - The public unique ID of the leave request (e.g., LVR001).
     * @param {object} adminUser - The admin/manager performing the action (should contain id and employeeId).
     * @param {string} [comments] - Optional review comments explaining the decision.
     * @returns {Promise<object>} The updated leave request record.
     */
    static async approveLeaveRequest(leaveRequestId, adminUser, comments) {
        return leaveRequestService.reviewLeaveRequest(
            leaveRequestId,
            adminUser,
            { decision: 'approved', reviewComments: comments }
        );
    }

    /**
     * Rejects a pending leave request.
     * 
     * @param {string} leaveRequestId - The public unique ID of the leave request (e.g., LVR001).
     * @param {object} adminUser - The admin/manager performing the action (should contain id and employeeId).
     * @param {string} [comments] - Optional review comments explaining the decision.
     * @returns {Promise<object>} The updated leave request record.
     */
    static async rejectLeaveRequest(leaveRequestId, adminUser, comments) {
        return leaveRequestService.reviewLeaveRequest(
            leaveRequestId,
            adminUser,
            { decision: 'rejected', reviewComments: comments }
        );
    }

    /**
     * Approves a pending unauthorised attendance request.
     *
     * @param {string} unauthorisedRequestId - The public request ID (e.g., UNA001).
     * @param {object} adminUser - The admin/manager performing the action.
     * @param {string} [comments] - Optional review comments.
     * @returns {Promise<object>} The updated unauthorised request record.
     */
    static async approveUnauthorisedRequest(unauthorisedRequestId, adminUser, comments) {
        return unauthorisedRequestService.reviewUnauthorisedRequest(
            unauthorisedRequestId,
            adminUser,
            { decision: 'approved', reviewComments: comments },
        );
    }

    /**
     * Rejects a pending unauthorised attendance request.
     *
     * @param {string} unauthorisedRequestId - The public request ID (e.g., UNA001).
     * @param {object} adminUser - The admin/manager performing the action.
     * @param {string} [comments] - Optional review comments.
     * @returns {Promise<object>} The updated unauthorised request record.
     */
    static async rejectUnauthorisedRequest(unauthorisedRequestId, adminUser, comments) {
        return unauthorisedRequestService.reviewUnauthorisedRequest(
            unauthorisedRequestId,
            adminUser,
            { decision: 'rejected', reviewComments: comments },
        );
    }
}

module.exports = AdminService;

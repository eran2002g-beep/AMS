// src/services/adminService.js - handles administrative actions on leave requests
// Delegates the core review logic to the underlying leaveRequestService.

const leaveRequestService = require('./leaveRequestService');

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
}

module.exports = AdminService;

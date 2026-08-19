// test/adminService.test.js
// Unit tests for the AdminService class.
//
// Tests are written with the built-in Node.js test runner (node:test) and
// assert, matching the patterns used throughout this test suite.

const test   = require('node:test');
const assert = require('node:assert/strict');

const AdminService = require('../src/services/adminService');
const leaveRequestService = require('../src/services/leaveRequestService');
const unauthorisedRequestService = require('../src/services/unauthorisedRequestService');

test('AdminService.approveLeaveRequest delegates to leaveRequestService.reviewLeaveRequest with decision approved', async (t) => {
    const originalReviewLeaveRequest = leaveRequestService.reviewLeaveRequest;

    t.after(() => {
        leaveRequestService.reviewLeaveRequest = originalReviewLeaveRequest;
    });

    let capturedParams = null;
    leaveRequestService.reviewLeaveRequest = async (leaveRequestId, adminUser, options) => {
        capturedParams = { leaveRequestId, adminUser, options };
        return { id: 123, status: 'approved' };
    };

    const adminUser = { id: 1, employeeId: 'EMP001' };
    const comments = 'Approved - request fits team schedule';
    
    const result = await AdminService.approveLeaveRequest('LVR001', adminUser, comments);

    assert.deepEqual(capturedParams, {
        leaveRequestId: 'LVR001',
        adminUser,
        options: {
            decision: 'approved',
            reviewComments: comments,
        },
    });
    assert.deepEqual(result, { id: 123, status: 'approved' });
});

test('AdminService.rejectLeaveRequest delegates to leaveRequestService.reviewLeaveRequest with decision rejected', async (t) => {
    const originalReviewLeaveRequest = leaveRequestService.reviewLeaveRequest;

    t.after(() => {
        leaveRequestService.reviewLeaveRequest = originalReviewLeaveRequest;
    });

    let capturedParams = null;
    leaveRequestService.reviewLeaveRequest = async (leaveRequestId, adminUser, options) => {
        capturedParams = { leaveRequestId, adminUser, options };
        return { id: 123, status: 'rejected' };
    };

    const adminUser = { id: 1, employeeId: 'EMP001' };
    const comments = 'Rejected - operational coverage needed';
    
    const result = await AdminService.rejectLeaveRequest('LVR001', adminUser, comments);

    assert.deepEqual(capturedParams, {
        leaveRequestId: 'LVR001',
        adminUser,
        options: {
            decision: 'rejected',
            reviewComments: comments,
        },
    });
    assert.deepEqual(result, { id: 123, status: 'rejected' });
});

test('AdminService.approveUnauthorisedRequest delegates with decision approved', async (t) => {
    const originalReview = unauthorisedRequestService.reviewUnauthorisedRequest;

    t.after(() => {
        unauthorisedRequestService.reviewUnauthorisedRequest = originalReview;
    });

    let capturedParams = null;
    unauthorisedRequestService.reviewUnauthorisedRequest = async (requestId, adminUser, options) => {
        capturedParams = { requestId, adminUser, options };
        return { unauthorisedRequestId: requestId, status: 'approved' };
    };

    const adminUser = { id: 1, employeeId: 'EMP001' };
    const result = await AdminService.approveUnauthorisedRequest('UNA001', adminUser, 'Times verified');

    assert.deepEqual(capturedParams, {
        requestId: 'UNA001',
        adminUser,
        options: { decision: 'approved', reviewComments: 'Times verified' },
    });
    assert.deepEqual(result, { unauthorisedRequestId: 'UNA001', status: 'approved' });
});

test('AdminService.rejectUnauthorisedRequest delegates with decision rejected', async (t) => {
    const originalReview = unauthorisedRequestService.reviewUnauthorisedRequest;

    t.after(() => {
        unauthorisedRequestService.reviewUnauthorisedRequest = originalReview;
    });

    let capturedParams = null;
    unauthorisedRequestService.reviewUnauthorisedRequest = async (requestId, adminUser, options) => {
        capturedParams = { requestId, adminUser, options };
        return { unauthorisedRequestId: requestId, status: 'rejected' };
    };

    const adminUser = { id: 1, employeeId: 'EMP001' };
    const result = await AdminService.rejectUnauthorisedRequest('UNA001', adminUser, 'Insufficient evidence');

    assert.deepEqual(capturedParams, {
        requestId: 'UNA001',
        adminUser,
        options: { decision: 'rejected', reviewComments: 'Insufficient evidence' },
    });
    assert.deepEqual(result, { unauthorisedRequestId: 'UNA001', status: 'rejected' });
});

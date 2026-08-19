// test/reviewChain.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
    canAcceptRequest,
    assertCanReview,
    resolveReviewStatus,
    applyReviewDecision,
    statusFilterWhere,
    reviewSuccessMessage,
} = require('../src/services/reviewChain');

const SUPERVISOR_ID = 10;
const HOD_ID = 20;

const bothAssigned = (overrides = {}) => ({
    status: 'pending',
    supervisor: SUPERVISOR_ID,
    hod: HOD_ID,
    ...overrides,
});

test('supervisor can accept a pending request when both are assigned', () => {
    assert.equal(canAcceptRequest(bothAssigned(), SUPERVISOR_ID), true);
    assert.equal(canAcceptRequest(bothAssigned(), HOD_ID), false);
});

test('HOD cannot accept until supervisor has accepted', () => {
    try {
        assertCanReview(bothAssigned(), HOD_ID, { kind: 'leave request' });
        assert.fail('expected assertCanReview to throw');
    } catch (err) {
        assert.equal(err.status, 403);
        assert.match(err.message, /Supervisor must accept/);
    }
});

test('supervisor accept moves status to supervisor_approved', () => {
    assert.equal(
        resolveReviewStatus(bothAssigned(), SUPERVISOR_ID, 'approved'),
        'supervisor_approved',
    );
});

test('HOD can accept after supervisor_approved', () => {
    const request = bothAssigned({ status: 'supervisor_approved' });
    assert.equal(canAcceptRequest(request, HOD_ID), true);
    assert.equal(canAcceptRequest(request, SUPERVISOR_ID), false);
    assert.equal(resolveReviewStatus(request, HOD_ID, 'approved'), 'approved');
});

test('either reviewer may reject at their own step', () => {
    assert.equal(
        resolveReviewStatus(bothAssigned(), SUPERVISOR_ID, 'rejected'),
        'rejected',
    );
    assert.equal(
        resolveReviewStatus(bothAssigned({ status: 'supervisor_approved' }), HOD_ID, 'rejected'),
        'rejected',
    );
});

test('HOD completes the chain in one step when no supervisor is assigned', () => {
    const request = { status: 'pending', supervisor: null, hod: HOD_ID };
    assert.equal(canAcceptRequest(request, HOD_ID), true);
    assert.equal(resolveReviewStatus(request, HOD_ID, 'approved'), 'approved');
});

test('supervisor completes the chain in one step when no HOD is assigned', () => {
    const request = { status: 'pending', supervisor: SUPERVISOR_ID, hod: null };
    assert.equal(canAcceptRequest(request, SUPERVISOR_ID), true);
    assert.equal(resolveReviewStatus(request, SUPERVISOR_ID, 'approved'), 'approved');
});

test('same person as HOD and supervisor completes the chain in one step', () => {
    const request = { status: 'pending', supervisor: HOD_ID, hod: HOD_ID };
    assert.equal(canAcceptRequest(request, HOD_ID), true);
    assert.equal(resolveReviewStatus(request, HOD_ID, 'approved'), 'approved');
});

test('applyReviewDecision records the viewer and next status', () => {
    const request = bothAssigned();
    const next = applyReviewDecision(
        request,
        { id: SUPERVISOR_ID, employeeId: 'EMP010' },
        'approved',
        'Looks fine',
    );
    assert.equal(next, 'supervisor_approved');
    assert.equal(request.status, 'supervisor_approved');
    assert.equal(request.reviewedBy, 'EMP010');
    assert.equal(request.reviewComments, 'Looks fine');
    assert.ok(request.reviewedAt instanceof Date);
});

test('statusFilterWhere maps awaiting to in-flight statuses', () => {
    const { Op } = require('sequelize');
    assert.deepEqual(statusFilterWhere('awaiting'), { [Op.in]: ['pending', 'supervisor_approved'] });
    assert.equal(statusFilterWhere('pending'), 'pending');
    assert.equal(statusFilterWhere(undefined), undefined);
});

test('reviewSuccessMessage describes the supervisor step', () => {
    assert.equal(
        reviewSuccessMessage('Leave request', 'supervisor_approved'),
        'Leave request accepted by supervisor. Awaiting HOD approval.',
    );
    assert.equal(
        reviewSuccessMessage('Leave request', 'approved'),
        'Leave request approved successfully.',
    );
});

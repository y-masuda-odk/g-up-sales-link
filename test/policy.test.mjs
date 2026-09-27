import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canEditCase,
  canEditProduct,
  canManageShare,
  canViewCase,
  matchesVisibleSearch,
  visibleCaseFields,
} from '../lib/policy.ts';

const owner = { id: 1, teamId: 10, role: 'member' };
const teammate = { id: 2, teamId: 10, role: 'team_admin' };
const partner = { id: 3, teamId: 20, role: 'member' };
const salesCase = {
  creatorId: 1,
  teamId: 10,
  isDraft: false,
  listVisible: true,
  showDepartment: false,
  showIssue: false,
  department: 'IR室',
  issueSummary: '非公開の課題',
  status: '提案中',
  nextAction: '来週面談',
  accountName: 'A大学',
};

test('private cases stay with their creator, including against managers', () => {
  assert.equal(
    canViewCase(owner, { ...salesCase, listVisible: false }, true),
    true,
  );
  assert.equal(
    canViewCase(teammate, { ...salesCase, listVisible: false }, true),
    false,
  );
  assert.equal(
    canViewCase(
      { id: 4, teamId: null, role: 'global_admin' },
      { ...salesCase, listVisible: false },
      true,
    ),
    false,
  );
  assert.equal(
    canViewCase(partner, { ...salesCase, isDraft: true }, true),
    false,
  );
  assert.equal(canEditCase(teammate, salesCase), false);
});

test('team sharing and field masks are enforced before searching', () => {
  assert.equal(canViewCase(partner, salesCase, false), false);
  assert.equal(canViewCase(partner, salesCase, true), true);
  const projected = visibleCaseFields(partner, salesCase);
  assert.equal(projected.department, null);
  assert.equal(projected.issueSummary, null);
  assert.equal(projected.status, null);
  assert.equal(
    matchesVisibleSearch(
      { ...projected, teamName: '第一部隊', productNames: [] },
      '非公開の課題',
    ),
    false,
  );
  assert.equal(
    matchesVisibleSearch(
      { ...projected, teamName: '第一部隊', productNames: [] },
      'A大学',
    ),
    true,
  );
});

test('product and sharing edits follow team roles', () => {
  assert.equal(canEditProduct(partner, 10), false);
  assert.equal(canEditProduct(teammate, 10), true);
  assert.equal(canManageShare(teammate, 10), true);
  assert.equal(canManageShare(teammate, 20), false);
});

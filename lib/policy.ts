export type Role = 'global_admin' | 'team_admin' | 'member';

export type Viewer = { id: number; teamId: number | null; role: Role };
export type CaseVisibility = {
  creatorId: number;
  teamId: number;
  isDraft: boolean | number;
  listVisible: boolean | number;
  showDepartment: boolean | number;
  showIssue: boolean | number;
};

export function canViewCase(
  viewer: Viewer,
  salesCase: CaseVisibility,
  shareEnabled: boolean,
): boolean {
  if (viewer.id === salesCase.creatorId) return true;
  return (
    !salesCase.isDraft &&
    !!salesCase.listVisible &&
    viewer.teamId !== null &&
    shareEnabled
  );
}

export function canEditCase(
  viewer: Viewer,
  salesCase: CaseVisibility,
): boolean {
  return viewer.id === salesCase.creatorId;
}

export function canEditProduct(viewer: Viewer, productTeamId: number): boolean {
  return viewer.teamId !== null && viewer.teamId === productTeamId;
}

export function canManageShare(viewer: Viewer, fromTeamId: number): boolean {
  return (
    viewer.role === 'global_admin' ||
    (viewer.role === 'team_admin' && viewer.teamId === fromTeamId)
  );
}

export function visibleCaseFields<
  T extends CaseVisibility & {
    department: string | null;
    issueSummary: string | null;
    status: string | null;
    amount: number;
    revenuePeriod: string;
    nextAction: string | null;
  },
>(viewer: Viewer, salesCase: T): T {
  if (viewer.id === salesCase.creatorId) return salesCase;
  return {
    ...salesCase,
    department: salesCase.showDepartment ? salesCase.department : null,
    issueSummary: salesCase.showIssue ? salesCase.issueSummary : null,
    status: null,
    amount: 0,
    revenuePeriod: salesCase.revenuePeriod,
    nextAction: null,
  };
}

export function matchesVisibleSearch(
  row: {
    accountName: string;
    department: string | null;
    issueSummary: string | null;
    teamName: string;
    productNames: string[];
  },
  query: string,
): boolean {
  const needle = query.trim().toLocaleLowerCase('ja-JP');
  if (!needle) return true;
  return [
    row.accountName,
    row.department,
    row.issueSummary,
    row.teamName,
    ...row.productNames,
  ].some((value) => value?.toLocaleLowerCase('ja-JP').includes(needle));
}

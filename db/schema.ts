import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const organizations = sqliteTable(
  'organizations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind', { enum: ['university', 'company'] }).notNull(),
    name: text('name').notNull(),
    department: text('department').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('idx_organizations_name').on(table.name)],
);

export const opportunities = sqliteTable(
  'opportunities',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id),
    ownerName: text('owner_name').notNull(),
    status: text('status').notNull(),
    nextAction: text('next_action'),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_opportunities_status_owner').on(table.status, table.ownerName),
  ],
);

export const issues = sqliteTable(
  'issues',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    opportunityId: integer('opportunity_id')
      .notNull()
      .references(() => opportunities.id),
    summary: text('summary').notNull(),
    sourceNote: text('source_note'),
    urgency: text('urgency').notNull().default('normal'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('idx_issues_opportunity_id').on(table.opportunityId)],
);

export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    providerName: text('provider_name').notNull(),
    contactName: text('contact_name').notNull(),
    category: text('category').notNull(),
    targetDescription: text('target_description').notNull(),
    outcomeDescription: text('outcome_description').notNull(),
    tags: text('tags').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [
    index('idx_products_active_category').on(table.active, table.category),
  ],
);

export const matches = sqliteTable(
  'matches',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    issueId: integer('issue_id')
      .notNull()
      .references(() => issues.id),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    score: integer('score').notNull(),
    reason: text('reason').notNull(),
    shareStatus: text('share_status').notNull().default('suggested'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('idx_matches_issue_score').on(table.issueId, table.score)],
);

// The prototype tables above are retained so an existing D1 database can be
// migrated without discarding data. The tables below back the shared MVP.
export const companies = sqliteTable('companies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const teams = sqliteTable(
  'teams',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('idx_teams_company').on(table.companyId)],
);

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', {
      enum: ['global_admin', 'team_admin', 'member'],
    }).notNull(),
    teamId: integer('team_id').references(() => teams.id),
    disabled: integer('disabled', { mode: 'boolean' }).notNull().default(false),
    failedLogins: integer('failed_logins').notNull().default(0),
    lockedUntil: text('locked_until'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_users_email').on(table.email),
    index('idx_users_team').on(table.teamId),
  ],
);

export const invitations = sqliteTable(
  'invitations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull(),
    role: text('role', {
      enum: ['global_admin', 'team_admin', 'member'],
    }).notNull(),
    teamId: integer('team_id').references(() => teams.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    usedAt: text('used_at'),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_invitations_token').on(table.tokenHash),
    index('idx_invitations_email').on(table.email),
  ],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_sessions_token').on(table.tokenHash),
    index('idx_sessions_user').on(table.userId),
  ],
);

export const teamShares = sqliteTable(
  'team_shares',
  {
    fromTeamId: integer('from_team_id')
      .notNull()
      .references(() => teams.id),
    toTeamId: integer('to_team_id')
      .notNull()
      .references(() => teams.id),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [
    uniqueIndex('idx_team_shares_pair').on(table.fromTeamId, table.toTeamId),
  ],
);

export const salesCases = sqliteTable(
  'sales_cases',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    creatorId: integer('creator_id')
      .notNull()
      .references(() => users.id),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    accountKind: text('account_kind', {
      enum: ['university', 'company'],
    }).notNull(),
    accountName: text('account_name').notNull(),
    department: text('department'),
    issueSummary: text('issue_summary'),
    status: text('status'),
    nextAction: text('next_action'),
    isDraft: integer('is_draft', { mode: 'boolean' }).notNull().default(true),
    listVisible: integer('list_visible', { mode: 'boolean' })
      .notNull()
      .default(true),
    showDepartment: integer('show_department', { mode: 'boolean' })
      .notNull()
      .default(true),
    showIssue: integer('show_issue', { mode: 'boolean' })
      .notNull()
      .default(true),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_sales_cases_team').on(table.teamId),
    index('idx_sales_cases_creator').on(table.creatorId),
  ],
);

export const catalogProducts = sqliteTable(
  'catalog_products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    creatorId: integer('creator_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    description: text('description'),
    targetCustomer: text('target_customer'),
    outcome: text('outcome'),
    contact: text('contact'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('idx_catalog_products_team').on(table.teamId)],
);

export const caseProducts = sqliteTable(
  'case_products',
  {
    caseId: integer('case_id')
      .notNull()
      .references(() => salesCases.id),
    productId: integer('product_id')
      .notNull()
      .references(() => catalogProducts.id),
    stage: text('stage', { enum: ['mentioned', 'proposed'] }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_case_products_pair').on(table.caseId, table.productId),
  ],
);

export const consultations = sqliteTable(
  'consultations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    caseId: integer('case_id')
      .notNull()
      .references(() => salesCases.id),
    senderId: integer('sender_id')
      .notNull()
      .references(() => users.id),
    accountName: text('account_name'),
    department: text('department'),
    issueSummary: text('issue_summary'),
    productSummary: text('product_summary'),
    note: text('note'),
    withdrawnAt: text('withdrawn_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('idx_consultations_sender').on(table.senderId)],
);

export const consultationRecipients = sqliteTable(
  'consultation_recipients',
  {
    consultationId: integer('consultation_id')
      .notNull()
      .references(() => consultations.id),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    handled: integer('handled', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    uniqueIndex('idx_consultation_recipients_pair').on(
      table.consultationId,
      table.teamId,
    ),
    index('idx_consultation_recipients_team').on(table.teamId),
  ],
);

export const auditEvents = sqliteTable('audit_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorId: integer('actor_id').references(() => users.id),
  kind: text('kind').notNull(),
  targetType: text('target_type').notNull(),
  targetId: integer('target_id'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

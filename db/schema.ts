import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const organizations = sqliteTable('organizations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind', { enum: ['university', 'company'] }).notNull(),
  name: text('name').notNull(),
  department: text('department').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index('idx_organizations_name').on(table.name)]);

export const opportunities = sqliteTable('opportunities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  ownerName: text('owner_name').notNull(),
  status: text('status').notNull(),
  nextAction: text('next_action'),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index('idx_opportunities_status_owner').on(table.status, table.ownerName)]);

export const issues = sqliteTable('issues', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  opportunityId: integer('opportunity_id').notNull().references(() => opportunities.id),
  summary: text('summary').notNull(),
  sourceNote: text('source_note'),
  urgency: text('urgency').notNull().default('normal'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index('idx_issues_opportunity_id').on(table.opportunityId)]);

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  providerName: text('provider_name').notNull(),
  contactName: text('contact_name').notNull(),
  category: text('category').notNull(),
  targetDescription: text('target_description').notNull(),
  outcomeDescription: text('outcome_description').notNull(),
  tags: text('tags').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
}, (table) => [index('idx_products_active_category').on(table.active, table.category)]);

export const matches = sqliteTable('matches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  issueId: integer('issue_id').notNull().references(() => issues.id),
  productId: integer('product_id').notNull().references(() => products.id),
  score: integer('score').notNull(),
  reason: text('reason').notNull(),
  shareStatus: text('share_status').notNull().default('suggested'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index('idx_matches_issue_score').on(table.issueId, table.score)]);

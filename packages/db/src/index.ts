// @readyboard/db — PowerSync schema + Supabase connector

// PowerSync schema (platform-agnostic, uses @powersync/common)
export { AppSchema } from './powersync/schema';
export type { Database } from './powersync/schema';

// PowerSync ↔ Supabase connector
export { SupabaseConnector } from './powersync/SupabaseConnector';
export type { SupabaseConnectorConfig } from './powersync/SupabaseConnector';

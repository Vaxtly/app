/** All entity types matching the database schema. UUID primary keys stored as TEXT. */

export interface Workspace {
  id: string
  name: string
  description: string | null
  order: number
  settings: string | null // JSON string
  created_at: string
  updated_at: string
}

export interface Collection {
  id: string
  workspace_id: string | null
  name: string
  description: string | null
  order: number
  variables: string | null // JSON string: Record<string, string>
  remote_sha: string | null
  remote_synced_at: string | null
  is_dirty: number // 0 | 1 (SQLite boolean)
  sync_enabled: number // 0 | 1
  environment_ids: string | null // JSON string: string[]
  default_environment_id: string | null
  auth: string | null // JSON string: AuthConfig
  scripts: string | null // JSON string: ScriptsConfig
  file_shas: string | null // JSON string: Record<string, FileState>
  external_key: string | null
  created_at: string
  updated_at: string
}

export interface FileState {
  content_hash: string
  remote_sha: string | null
  commit_sha: string | null
}

export interface Folder {
  id: string
  collection_id: string
  parent_id: string | null
  name: string
  order: number
  environment_ids: string | null // JSON string: string[]
  default_environment_id: string | null
  auth: string | null // JSON string: AuthConfig
  scripts: string | null // JSON string: ScriptsConfig
  external_key: string | null
  created_at: string
  updated_at: string
}

export interface Request {
  id: string
  collection_id: string
  folder_id: string | null
  name: string
  url: string
  method: string
  headers: string | null // JSON string: KeyValueEntry[]
  query_params: string | null // JSON string: KeyValueEntry[]
  body: string | null // JSON string (body content varies by body_type)
  body_type: string // 'none' | 'json' | 'xml' | 'form-data' | 'urlencoded' | 'raw' | 'graphql'
  auth: string | null // JSON string: AuthConfig
  scripts: string | null // JSON string: ScriptsConfig
  order: number
  external_key: string | null
  created_at: string
  updated_at: string
}

export interface Environment {
  id: string
  workspace_id: string | null
  parent_id: string | null
  name: string
  variables: string // JSON string: EnvironmentVariable[]
  is_active: number // 0 | 1
  order: number
  vault_synced: number // 0 | 1
  vault_path: string | null
  external_key: string | null
  created_at: string
  updated_at: string
}

export interface AppSetting {
  key: string
  value: string
}

export interface WindowState {
  x: number | null
  y: number | null
  width: number
  height: number
  is_maximized: number // 0 | 1
}

// --- Nested JSON types ---

export interface KeyValueEntry {
  key: string
  value: string
  enabled: boolean
  description?: string
  generated?: boolean
}

export interface AuthConfig {
  type: 'inherit' | 'none' | 'bearer' | 'basic' | 'api-key' | 'oauth2'
  bearer_token?: string
  basic_username?: string
  basic_password?: string
  api_key_header?: string
  api_key_value?: string

  // OAuth 2.0
  oauth2_grant_type?: 'authorization_code' | 'client_credentials' | 'password'
  oauth2_access_token_url?: string
  oauth2_authorization_url?: string
  oauth2_client_id?: string
  oauth2_client_secret?: string
  oauth2_scope?: string
  oauth2_username?: string
  oauth2_password?: string
  oauth2_redirect_url?: string
  oauth2_pkce?: boolean
  oauth2_audience?: string
  oauth2_access_token?: string
  oauth2_refresh_token?: string
  oauth2_token_type?: string
  oauth2_expires_at?: number
}

export interface ScriptsConfig {
  pre_request?: PreRequestScript
  post_response?: PostResponseScript[]
  assertions?: Assertion[]
}

// --- Assertion types ---

export type AssertionType = 'status' | 'header' | 'json_path' | 'response_time'

export type AssertionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'exists'
  | 'not_exists'
  | 'less_than'
  | 'greater_than'
  | 'matches_regex'

export interface Assertion {
  type: AssertionType
  target: string // header name, JSON path, or '' for status/response_time
  operator: AssertionOperator
  expected: string
  enabled: boolean
}

export interface AssertionResult {
  assertion: Assertion
  passed: boolean
  actual: string | null
  error?: string
}

export interface PreRequestScript {
  action: 'send_request'
  request_id: string
  skip_if_valid?: {
    token_variable: string      // e.g., 'api_token' — skip if this var is set
    expires_at_variable: string // e.g., 'api_token_expires_at' — skip if not expired (Unix ms)
  }
}

export interface PostResponseScript {
  action: 'set_variable' | 'set_token_expiry'
  source: string // e.g., 'body.data.token', 'header.X-Auth', 'status', 'body.expires_in'
  target: string // variable key name
}

export interface EnvironmentVariable {
  key: string
  value: string
  enabled: boolean
}

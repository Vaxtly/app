/**
 * MCP stdio server. Exposes the four upsert verbs (plus ping) as MCP tools.
 *
 * Tools call back into the same RPC client used by the CLI's verb commands —
 * the agent-socket server in the running Vaxtly app is the single validation
 * and persistence point. The MCP layer is a thin protocol adapter.
 *
 * Uses dynamic imports for `@modelcontextprotocol/sdk/*` because the SDK is
 * ESM-only and the rest of this CLI is compiled to CommonJS. Dynamic import()
 * is preserved by TypeScript and supports loading ESM modules from CJS.
 */

import { loadConfig } from '../config'
import { rpc, RpcError } from '../client'

const KEY_VALUE_ENTRY = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    value: { type: 'string' },
    enabled: { type: 'boolean', default: true },
  },
  required: ['key', 'value'],
} as const

const TOOLS = [
  {
    name: 'vaxtly_ping',
    description:
      'Liveness check. Returns the running Vaxtly version. Use this first if you are not sure the app is running.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'vaxtly_upsert_collection',
    description:
      'Create or update a collection in Vaxtly, idempotent by external_key. Pick a stable slug (e.g. "acme", not a UUID) — re-running with the same external_key updates the existing collection. Fields you do not pass are preserved on update. If you are modifying an existing collection, call vaxtly_get_collection first to see current state. Returns { id, external_key, created, updated_at }.',
    inputSchema: {
      type: 'object',
      required: ['external_key', 'name'],
      properties: {
        external_key: { type: 'string', description: 'Stable identifier chosen by the caller. Reuse to update; vary to create.' },
        name: { type: 'string' },
        description: { type: 'string' },
        workspace_id: { type: 'string', description: 'Workspace UUID. Defaults to the first workspace.' },
      },
    },
  },
  {
    name: 'vaxtly_upsert_folder',
    description:
      'Create or update a folder inside a collection, idempotent by external_key. The collection must already exist and is referenced by its own external_key — call vaxtly_list_collections first if you do not know the available collection keys. Pass parent_folder_external_key to nest under another folder, or "" (empty string) to move to the collection root. Omit it to preserve the existing parent on update.',
    inputSchema: {
      type: 'object',
      required: ['collection_external_key', 'external_key', 'name'],
      properties: {
        collection_external_key: { type: 'string' },
        external_key: { type: 'string' },
        name: { type: 'string' },
        parent_folder_external_key: {
          type: ['string', 'null'],
          description: 'External key of the parent folder. Empty string or null places this folder at the collection root.',
        },
        workspace_id: { type: 'string' },
      },
    },
  },
  {
    name: 'vaxtly_upsert_request',
    description:
      'Create or update an API request inside a collection (optionally inside a folder), idempotent by external_key. IMPORTANT for updates: call vaxtly_get_request FIRST to see the existing shape — fields you do not pass are preserved, so re-passing the whole request and accidentally dropping a configured header/query/auth field is the most common mistake. Use stable slug-style external_keys (e.g. "users.list", "auth.login"), not UUIDs. Re-running with the same external_key updates the existing request and can move it between folders within the same collection (pass folder_external_key="" to move to the collection root). Headers and query params are arrays of {key, value, enabled}. Body is a JSON-encodable value or a string.',
    inputSchema: {
      type: 'object',
      required: ['collection_external_key', 'external_key', 'name'],
      properties: {
        collection_external_key: { type: 'string' },
        external_key: { type: 'string' },
        name: { type: 'string' },
        folder_external_key: {
          type: ['string', 'null'],
          description: 'External key of the parent folder. Empty string or null places this request at the collection root.',
        },
        method: { enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] },
        url: { type: 'string' },
        body_type: { enum: ['none', 'json', 'xml', 'form-data', 'urlencoded', 'raw', 'graphql'] },
        body: { description: 'Request body. JSON-encodable values are stringified; pass a string to send raw text.' },
        headers: { type: 'array', items: KEY_VALUE_ENTRY },
        query_params: { type: 'array', items: KEY_VALUE_ENTRY },
        auth: {
          type: 'object',
          description: 'AuthConfig — { type: "none"|"inherit"|"bearer"|"basic"|"api-key"|"oauth2", plus type-specific fields like bearer_token }.',
        },
        workspace_id: { type: 'string' },
      },
    },
  },
  {
    name: 'vaxtly_upsert_env',
    description:
      'Create or update an environment in the workspace, idempotent by external_key. IMPORTANT: passing variables REPLACES the entire variables array — it is not a merge. Use this when creating an env or populating from a known source (e.g. a .env file). When you want to add or change a SINGLE variable inside an existing env, prefer vaxtly_upsert_env_variable instead — it preserves the other variables, which you cannot safely re-pass here because values are always redacted on read. Omit variables entirely to leave them untouched. To make this env a child of another, pass parent_external_key — the parent must already exist and cannot itself be a child (Vaxtly caps the chain at 2).',
    inputSchema: {
      type: 'object',
      required: ['external_key', 'name'],
      properties: {
        external_key: { type: 'string' },
        name: { type: 'string' },
        parent_external_key: { type: ['string', 'null'] },
        variables: { type: 'array', items: KEY_VALUE_ENTRY },
        workspace_id: { type: 'string' },
      },
    },
  },
  {
    name: 'vaxtly_upsert_env_variable',
    description:
      'Add or update a SINGLE variable inside an existing environment, leaving the other variables untouched. This is the SAFE way to modify env variables when you cannot see existing values (which are always redacted on read). Idempotent on (env_external_key, key): if the key exists in the env, its value and enabled flag are updated in place; otherwise the variable is appended. Pass the value as plaintext — Vaxtly encrypts at rest. Empty string is allowed if you want to set the variable to empty.',
    inputSchema: {
      type: 'object',
      required: ['env_external_key', 'key', 'value'],
      properties: {
        env_external_key: { type: 'string', description: 'External key of the environment to modify.' },
        key: { type: 'string', description: 'Variable name (e.g. "API_KEY").' },
        value: { type: 'string', description: 'Plaintext value. Will be encrypted at rest.' },
        enabled: { type: 'boolean', default: true },
        workspace_id: { type: 'string' },
      },
    },
  },
  {
    name: 'vaxtly_list_workspaces',
    description: 'List all workspaces in Vaxtly. Returns [{id, name}].',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'vaxtly_list_collections',
    description: 'List collections in a workspace (defaults to the first). Returns [{id, external_key, name, description}].',
    inputSchema: {
      type: 'object',
      properties: { workspace_id: { type: 'string' } },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'vaxtly_list_folders',
    description: 'List folders inside a collection. Returns [{id, external_key, name, parent_external_key}] — use parent_external_key to reconstruct nesting.',
    inputSchema: {
      type: 'object',
      required: ['collection_external_key'],
      properties: {
        collection_external_key: { type: 'string' },
        workspace_id: { type: 'string' },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'vaxtly_list_requests',
    description: 'List requests inside a collection, optionally narrowed to one folder. Pass folder_external_key="" to filter to collection-root requests only. Returns [{id, external_key, name, method, url, folder_external_key}].',
    inputSchema: {
      type: 'object',
      required: ['collection_external_key'],
      properties: {
        collection_external_key: { type: 'string' },
        folder_external_key: { type: ['string', 'null'] },
        workspace_id: { type: 'string' },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'vaxtly_list_envs',
    description: 'List environments in a workspace, including parent chain. Returns [{id, external_key, name, is_active, vault_synced, parent_external_key}]. Variables are NOT returned here — use vaxtly_get_env (values are always redacted).',
    inputSchema: {
      type: 'object',
      properties: { workspace_id: { type: 'string' } },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'vaxtly_get_collection',
    description: 'Fetch a collection by external_key. Sensitive auth fields (bearer_token, basic_password, oauth2 secrets, api_key_value) are always replaced with "<redacted>" — there is no opt-in to see plaintext. Empty/null fields are preserved so you can tell configured vs unset.',
    inputSchema: {
      type: 'object',
      required: ['external_key'],
      properties: {
        external_key: { type: 'string' },
        workspace_id: { type: 'string' },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'vaxtly_get_folder',
    description: 'Fetch a folder by external_key within a collection. Sensitive auth fields are always redacted.',
    inputSchema: {
      type: 'object',
      required: ['collection_external_key', 'external_key'],
      properties: {
        collection_external_key: { type: 'string' },
        external_key: { type: 'string' },
        workspace_id: { type: 'string' },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'vaxtly_get_request',
    description: 'Fetch a request by external_key within a collection. Headers, query params, body, method, and url are returned as configured. Sensitive auth fields are always redacted — there is no opt-in.',
    inputSchema: {
      type: 'object',
      required: ['collection_external_key', 'external_key'],
      properties: {
        collection_external_key: { type: 'string' },
        external_key: { type: 'string' },
        workspace_id: { type: 'string' },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'vaxtly_get_env',
    description: 'Fetch an environment by external_key. Variable KEYS are visible so you can use them in substitution; every variable VALUE is always replaced with "<redacted>". Empty values stay empty so you can tell configured vs unset.',
    inputSchema: {
      type: 'object',
      required: ['external_key'],
      properties: {
        external_key: { type: 'string' },
        workspace_id: { type: 'string' },
      },
    },
    annotations: { readOnlyHint: true },
  },
] as const

const TOOL_TO_RPC: Record<string, string> = {
  vaxtly_ping: 'ping',
  vaxtly_upsert_collection: 'upsert.collection',
  vaxtly_upsert_folder: 'upsert.folder',
  vaxtly_upsert_request: 'upsert.request',
  vaxtly_upsert_env: 'upsert.env',
  vaxtly_upsert_env_variable: 'upsert.env_variable',
  vaxtly_list_workspaces: 'list.workspaces',
  vaxtly_list_collections: 'list.collections',
  vaxtly_list_folders: 'list.folders',
  vaxtly_list_requests: 'list.requests',
  vaxtly_list_envs: 'list.envs',
  vaxtly_get_collection: 'get.collection',
  vaxtly_get_folder: 'get.folder',
  vaxtly_get_request: 'get.request',
  vaxtly_get_env: 'get.env',
}

export async function runMcp(): Promise<void> {
  const { Server } = await import('@modelcontextprotocol/sdk/server/index.js')
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js')
  const { CallToolRequestSchema, ListToolsRequestSchema } = await import(
    '@modelcontextprotocol/sdk/types.js'
  )

  const server = new Server(
    { name: 'vaxtly', version: '0.0.0' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS as unknown as never }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const toolName = req.params.name
    const rpcMethod = TOOL_TO_RPC[toolName]
    if (!rpcMethod) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: `Unknown tool: ${toolName}` }],
      }
    }

    const args = (req.params.arguments ?? {}) as Record<string, unknown>
    try {
      const result = await rpc(loadConfig(), rpcMethod, args)
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
    } catch (err) {
      const message = err instanceof RpcError
        ? `Vaxtly error ${err.code}: ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Unknown error'
      return { isError: true, content: [{ type: 'text' as const, text: message }] }
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Keep the process alive while stdio is open; the SDK handles incoming
  // requests on the transport and will close when stdin closes.
  await new Promise(() => {})
}

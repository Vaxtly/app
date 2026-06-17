/**
 * Help text. Two layers:
 *   1. HELP_TOP — shown for `vaxtly`, `vaxtly --help`, `vaxtly help`. Includes
 *      a short conceptual intro so a fresh agent can pick up the model
 *      without having to consult external docs.
 *   2. helpForVerb / helpForSub — detailed per-verb help triggered by
 *      `vaxtly <verb> --help` or `vaxtly <verb> <sub> --help`. Each block
 *      ends with a runnable example to anchor the agent.
 *
 * Keep these as plain template strings (no formatting helpers). They go
 * straight to stdout; readability in a 100-col terminal is the only goal.
 */

export const HELP_TOP = `Vaxtly CLI — mirror API requests/collections/envs into a running Vaxtly app.

Vaxtly is a desktop API client (Postman/Insomnia alternative). This CLI lets
you (or an AI agent) reflect endpoints into it without clicking around — handy
when you've just written a route handler and want to test it next door.

Core idea: every entity has an external_key you choose. Re-running upsert
with the same key UPDATES the existing entity — no duplicates. Fields you
don't pass are preserved. To modify an existing entity, get it first to see
current state, then upsert what changed.

Usage:
  vaxtly upsert collection  --external-key <k> --name <n> [--description <d>]
  vaxtly upsert folder      --collection-external-key <c> --external-key <k> --name <n>
                            [--parent-folder-external-key <pk> | --parent-folder-external-key '']
  vaxtly upsert request     --collection-external-key <c> --external-key <k> --name <n>
                            [--folder-external-key <fk> | --folder-external-key '']
                            [--method GET|POST|...] [--url <u>] [--body-type <t>]
                            [--body '<json>' | --body @path/to/file]
                            [--header 'X-Foo: bar' ...] [--query 'k=v' ...]
                            [--auth-type none|inherit|bearer|basic|api-key  + matching flags]
  vaxtly upsert env         --external-key <k> --name <n>
                            [--parent-external-key <pk> | --parent-external-key '']
                            [--var 'KEY=value' ...]
  vaxtly upsert env-var     --env-external-key <ek> --key <k> --value <v> [--disabled]
                            (add/update ONE variable; the rest are preserved.
                             prefer this over 'upsert env --var' when modifying
                             an existing env, since values are redacted on read.)

  vaxtly list  workspaces|collections|folders|requests|envs   [filter flags]
  vaxtly get   collection|folder|request|env  --external-key <k> [parent flags]

  vaxtly ping              Verify the running app is reachable.
  vaxtly install-cli       Symlink this binary into ~/.local/bin (POSIX only).
  vaxtly mcp               Run as an MCP stdio server for AI agents.
  vaxtly guide             Long-form guide aimed at AI coding agents — read this
                           if you're an agent meeting Vaxtly for the first time.

  vaxtly <verb> --help              Help for a specific verb.
  vaxtly <verb> <subcommand> --help Help for a specific subcommand.

Example flow:
  vaxtly list collections                                       # see what's there
  vaxtly upsert collection --external-key acme --name "Acme API"
  vaxtly upsert request --collection-external-key acme \\
    --external-key users.list --name "List users" \\
    --method GET --url https://api.example.com/users
  vaxtly get request --collection-external-key acme --external-key users.list
  vaxtly upsert request --collection-external-key acme \\
    --external-key users.list --url https://api.example.com/v2/users

Secrets you write (bearer tokens, env values) are encrypted at rest.
Reads ALWAYS return them as "<redacted>" — there is no opt-in.

All upserts accept --workspace-id <uuid> (defaults to first workspace).
Re-running with the same --external-key updates the existing entity.

Exit codes: 0 ok, 1 generic, 2 validation/not-found, 3 auth, 4 not running, 5 conflict.
`

const HELP_UPSERT_SUMMARY = `vaxtly upsert <collection|folder|request|env|env-var> [flags]

Create or update a Vaxtly entity, keyed on --external-key (your stable id).
Re-running with the same external_key updates the existing entity — fields
you don't pass are preserved. Use \`vaxtly upsert <sub> --help\` for details.

  vaxtly upsert collection --help
  vaxtly upsert folder --help
  vaxtly upsert request --help
  vaxtly upsert env --help
  vaxtly upsert env-var --help   (single variable inside an existing env)
`

const HELP_UPSERT_COLLECTION = `vaxtly upsert collection — create or update a collection.

Idempotent on --external-key. First call creates; subsequent calls update.

Required:
  --external-key <k>     Stable id you choose (e.g. "acme", "billing-api").
  --name <n>             Display name. Required on create, preserved on update.

Optional:
  --description <d>      Free-text description.
  --id <uuid>            Adopt an existing collection (e.g. one created in the
                         UI with no external_key) under --external-key. Get the
                         uuid from \`vaxtly list collections\`. Prevents duplicates.
  --workspace-id <uuid>  Workspace UUID. Defaults to the first workspace.
                         Discover with: vaxtly list workspaces

Output (stdout): {"id":"…","external_key":"…","created":true|false,"updated_at":"…"}

Example:
  vaxtly upsert collection --external-key acme --name "Acme API"

Adopt a UI-created collection (assign it an external_key, no duplicate):
  vaxtly upsert collection --id <uuid> --external-key acme --name "Acme API"
`

const HELP_UPSERT_FOLDER = `vaxtly upsert folder — create or update a folder inside a collection.

The collection must already exist and is referenced by its external_key.
Folders can nest arbitrarily; specify the parent folder's external_key via
--parent-folder-external-key. An empty string ('') means collection root.

Required:
  --collection-external-key <ck>   External key of the parent collection.
  --external-key <k>               Stable id for this folder.
  --name <n>                       Display name (required on create).

Optional:
  --id <uuid>                        Adopt an existing folder (from
                                     \`vaxtly list folders\`) under --external-key.
  --parent-folder-external-key <pk>  Nest under this folder. '' = root.
                                     Omit to preserve existing parent on update.
  --workspace-id <uuid>              Defaults to the first workspace.

Example:
  vaxtly upsert folder --collection-external-key acme --external-key auth --name "Auth"
  vaxtly upsert folder --collection-external-key acme --external-key admin \\
    --name "Admin" --parent-folder-external-key auth
`

const HELP_UPSERT_REQUEST = `vaxtly upsert request — create or update an API request inside a collection.

Re-running with the same external_key updates the existing request and can
move it between folders within the same collection. Fields not passed are
preserved — to update only the URL, just pass --url.

When MODIFYING an existing request, run \`vaxtly get request …\` first to see
the current shape (headers, body, auth) so you don't accidentally drop fields.

Required:
  --collection-external-key <ck>    External key of the parent collection.
  --external-key <k>                Stable id (e.g. "users.list", "auth.login").
  --name <n>                        Display name (required on create).

Common:
  --method GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS
  --url <u>
  --header 'X-Foo: bar'             Repeatable.
  --query 'k=v'                     Repeatable.
  --body '<json>'                   Inline body.
  --body @path/to/file              Read body from a file.
  --body-type json|form|urlencoded|raw|graphql

Adopt (UI-created request with no external_key):
  --id <uuid>                       Adopt the request with this uuid (from
                                    \`vaxtly list requests\`) under --external-key.

Folder placement:
  --folder-external-key <fk>        Place inside a folder.
  --folder-external-key ''          Move to collection root.
  (omit)                            Preserve existing folder.

Auth (one type at a time):
  --auth-type none|inherit
  --auth-type bearer  --bearer-token <t>
  --auth-type basic   --basic-username <u> --basic-password <p>
  --auth-type api-key --api-key-name <name> --api-key-value <v> [--api-key-in header|query]

Example (create):
  vaxtly upsert request --collection-external-key acme --external-key users.list \\
    --name "List users" --method GET --url "https://api.example.com/users" \\
    --header "Accept: application/json"

Example (modify URL only — everything else preserved):
  vaxtly upsert request --collection-external-key acme --external-key users.list \\
    --url "https://api.example.com/v2/users"
`

const HELP_UPSERT_ENV = `vaxtly upsert env — create or update an environment in the workspace.

Environments are sets of variables used in {{var}} substitution. They can
inherit from a parent environment (one level only — Vaxtly caps the chain
at 2). Parent must exist before child.

WARNING: passing --var REPLACES the entire variables array. Use this when
creating an env or populating from a known source (e.g. a .env file). When
adding/changing a single variable inside an existing env, use
\`vaxtly upsert env-var\` instead — values come back as "<redacted>" on read,
so re-passing the full array would wipe whatever you can't see.

Required:
  --external-key <k>       Stable id (e.g. "local", "prod").
  --name <n>               Display name (required on create).

Optional:
  --id <uuid>              Adopt an existing env (from \`vaxtly list envs\`)
                           under --external-key. Prevents duplicates.
  --var 'KEY=value'        Repeatable. WARNING: replaces the whole array.
  --parent-external-key <pk>   Inherit from another env. '' = no parent.
  --workspace-id <uuid>    Defaults to the first workspace.

Note: variable values are encrypted at rest. Reads always show "<redacted>".

Example (initial populate):
  vaxtly upsert env --external-key local --name "Local" \\
    --var "API_KEY=dev-secret" --var "BASE_URL=http://localhost:3000"
`

const HELP_UPSERT_ENV_VAR = `vaxtly upsert env-var — add or update ONE variable inside an env, safely.

Idempotent on (env_external_key, key). Other variables in the env are
preserved. Use this — not \`upsert env --var\` — when modifying an existing
environment, because reads redact values so you can't safely re-pass the
full array.

Required:
  --env-external-key <ek>  External key of the env to modify.
  --key <k>                Variable key (e.g. "API_KEY").
  --value <v>              Plaintext value. Encrypted at rest by Vaxtly.
                           Empty string is allowed (sets the value to empty).

Optional:
  --disabled               Set the variable as disabled (default: enabled).
  --workspace-id <uuid>    Defaults to the first workspace.

Output: {"id":"…","env_external_key":"…","key":"…","created":true|false,"updated_at":"…"}

Example (add a new var):
  vaxtly upsert env-var --env-external-key local --key TIMEOUT --value 30

Example (update an existing one):
  vaxtly upsert env-var --env-external-key local --key API_KEY --value "new-secret"
`

const HELP_LIST_SUMMARY = `vaxtly list <workspaces|collections|folders|requests|envs> [flags]

Slim, navigation-shaped output (id, external_key, name, plus parent refs).
Useful as the FIRST step when modifying existing data — list to find the
external_key you'll then \`get\` or \`upsert\` against.

  vaxtly list workspaces                                  # [{id, name}]
  vaxtly list collections [--workspace-id <uuid>]
  vaxtly list folders     --collection-external-key <ck>
  vaxtly list requests    --collection-external-key <ck> [--folder-external-key <fk>|'']
  vaxtly list envs        [--workspace-id <uuid>]
`

const HELP_GET_SUMMARY = `vaxtly get <collection|folder|request|env> --external-key <k>

Returns the full entity. Sensitive fields (bearer tokens, basic password,
oauth secrets, api_key_value, every env variable value) come back as
"<redacted>" — no opt-in. Empty/null sensitive fields stay empty so you
can distinguish configured-but-hidden from unset.

  vaxtly get collection --external-key <k> [--workspace-id <uuid>]
  vaxtly get folder     --collection-external-key <ck> --external-key <k>
  vaxtly get request    --collection-external-key <ck> --external-key <k>
  vaxtly get env        --external-key <k> [--workspace-id <uuid>]
`

export function helpForVerb(verb: string, sub?: string): string | undefined {
  if (verb === 'upsert') {
    if (!sub) return HELP_UPSERT_SUMMARY
    if (sub === 'collection') return HELP_UPSERT_COLLECTION
    if (sub === 'folder') return HELP_UPSERT_FOLDER
    if (sub === 'request') return HELP_UPSERT_REQUEST
    if (sub === 'env') return HELP_UPSERT_ENV
    if (sub === 'env-var') return HELP_UPSERT_ENV_VAR
  }
  if (verb === 'list') return HELP_LIST_SUMMARY
  if (verb === 'get') return HELP_GET_SUMMARY
  return undefined
}

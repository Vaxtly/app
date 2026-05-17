/**
 * Long-form guide aimed at AI coding agents meeting Vaxtly for the first time.
 * Printed by `vaxtly guide`. Optimized for an agent to paste into its context
 * once and have a complete mental model — concrete examples, idioms, and the
 * gotchas that the brief --help can't cover.
 *
 * If you change conventions (idempotency rules, redaction, scopes), update
 * this. It's the canonical agent-facing documentation; the brief help points
 * here for anything non-obvious.
 */

export const GUIDE = `# Vaxtly Agent Guide

A long-form explanation of the Vaxtly CLI aimed at AI coding agents.
Run \`vaxtly --help\` for the brief grammar reference.

## What Vaxtly is

Vaxtly is a desktop API client — a Postman/Insomnia alternative. It runs
locally on the user's machine. This CLI talks to a running Vaxtly app over
a Unix socket (no network exposure) and lets you mirror API endpoints
into it programmatically.

Typical user goal: "I just built/changed an endpoint, get it into my API
client so I can test it without retyping everything."

## Mental model

Organization (a tree):
  Workspace
    └── Collection ("Acme API")
          └── Folder (optional, can nest)
                └── Request (method + url + headers + body + auth)

Separately, per workspace:
  Environment ("Local", "Prod") — sets of {{var}} substitutions.
  Up to two levels deep (child can inherit from parent).

Almost all users have a single workspace. The CLI defaults to the first
workspace automatically — you rarely need --workspace-id.

## External keys: the single most important concept

Every entity has an \`external_key\` that YOU choose. It's the stable
handle you use across multiple invocations.

- Same key in the same scope → updates the existing entity.
- New key → creates a new entity.
- You should never need to know UUIDs.

Scope rules (what counts as "same scope"):
- Collections: unique per workspace.
- Folders: unique per collection.
- Requests: unique per collection. (You can move a request between folders
  inside the same collection by re-upserting with a different folder key —
  the key stays the same, the placement changes.)
- Environments: unique per workspace.

Pick descriptive slugs: \`users.list\`, \`auth.login\`, \`billing.checkout\`.
Avoid UUIDs as external_keys — they don't survive the user renaming the
underlying API and make the Vaxtly tree unreadable.

## Typical workflow

### "Add these endpoints to vaxtly" (fresh)

1. Check what's there first. Run \`vaxtly list collections\`. If a matching
   collection already exists, use its external_key. Otherwise:

2. Ensure a collection:
     vaxtly upsert collection --external-key <slug> --name "<API name>"
   Pick the slug from the API name or repo. Re-running is harmless.

3. (Optional) Create folders if the endpoints fall into groups:
     vaxtly upsert folder --collection-external-key <slug> \\
       --external-key auth --name "Auth"

4. Upsert each request with a stable external_key:
     vaxtly upsert request --collection-external-key <slug> \\
       --external-key users.list --name "List users" \\
       --method GET --url "http://localhost:3000/users"

### "Update the X endpoint" (modify)

1. Read the current state first:
     vaxtly get request --collection-external-key <c> --external-key <k>

   This returns method, url, headers, query, body — everything you need
   to reason about the change. Auth credentials come back redacted; that's
   expected.

2. Upsert only the fields that change. Everything you don't pass is
   preserved.
     vaxtly upsert request --collection-external-key <c> \\
       --external-key <k> --url "<new-url>"

You do NOT need to repeat headers/query/body unless they're changing.
This is the most common mistake: re-passing the whole shape and accidentally
dropping a field the user had configured.

## Secrets and redaction

Vaxtly encrypts auth credentials and env variable values at rest
(AES-256-GCM, keyed via the OS keychain). When you upsert a secret, it's
encrypted before being persisted.

**Reads always redact.** \`vaxtly get request\` on a request with a bearer
token returns \`"bearer_token":"<redacted>"\`. There is no flag to see
plaintext. The user can see actual values inside the Vaxtly UI.

If the user wants you to set a secret, pass it through normally — you just
can't read it back afterward. If the user wants you to know an existing
secret's value, they have to paste it to you manually. That's intentional:
it makes leakage via prompt injection from other tools a deliberate, manual
choice rather than a silent default.

Empty/null sensitive fields stay empty on read — so you can tell "this
auth is configured but I can't see the value" from "this auth is unset".

## Environment updates: full-replace vs single-variable

There are TWO ways to write env variables, and the choice matters.

**\`upsert.env\` with \`--var\` (full replace):** the variables array you pass
REPLACES the existing one entirely. Safe when:
  - Creating a new env from scratch.
  - Populating an env from a known source (a .env file you can read).

Unsafe when modifying an existing env, because read returns values as
\`<redacted>\` — you can't reconstruct what's already there to re-pass.

**\`upsert.env_variable\` (single key):** add or update ONE variable. The
rest of the env is untouched. Use this whenever you're modifying an
existing env.

  vaxtly upsert env-var --env-external-key local --key TIMEOUT --value 30
  vaxtly upsert env-var --env-external-key local --key API_KEY --value "rotated-secret"

Idempotent on \`(env_external_key, key)\`. If the key exists, the value
(and enabled flag) is updated in place; otherwise it's appended.

Decision rule:
  - "Set up a new env" / "import these N vars" → \`upsert env --var ...\`
  - "Add/change/rotate ONE var" → \`upsert env-var ...\`

Updating an env's name or parent without touching variables is safe with
\`upsert.env\` — just don't pass any \`--var\` flags.

## Common patterns

### Mirror a single route you just wrote
    vaxtly upsert collection --external-key myapp --name "My App"
    vaxtly upsert request --collection-external-key myapp \\
      --external-key users.list --name "List users" \\
      --method GET --url "http://localhost:3000/users"

### Mirror with headers and a JSON body from a file
    vaxtly upsert request --collection-external-key myapp \\
      --external-key users.create --name "Create user" \\
      --method POST --url "http://localhost:3000/users" \\
      --header "Content-Type: application/json" \\
      --body @./examples/create-user.json

### Mirror with bearer auth that references an env variable
    vaxtly upsert request --collection-external-key myapp \\
      --external-key admin.users --name "Admin: list users" \\
      --method GET --url "http://localhost:3000/admin/users" \\
      --auth-type bearer --bearer-token "{{ADMIN_TOKEN}}"

    vaxtly upsert env --external-key local --name "Local" \\
      --var "ADMIN_TOKEN=dev-token-from-.env"

(\`{{ADMIN_TOKEN}}\` is a Vaxtly variable reference — the literal string is
stored on the request; Vaxtly substitutes at request time from the active
environment. This is the right pattern for "the token differs per env".)

### Move a request between folders (same collection)
    vaxtly upsert request --collection-external-key myapp \\
      --external-key users.list --folder-external-key admin

### Move a request out of any folder (to collection root)
    vaxtly upsert request --collection-external-key myapp \\
      --external-key users.list --folder-external-key ''

(Note the empty quotes. Omitting the flag entirely preserves the current
folder. Passing '' explicitly clears it.)

## What NOT to do

- Don't invent UUIDs as external_keys. Use slugs (\`users.list\`, not
  \`0e7a3f12-...\`). Slugs are human-readable, survive renames, and won't
  collide with Vaxtly's internal UUIDs.

- Don't re-pass the entire request shape on every update. Only pass what's
  changing. Re-passing headers when you didn't mean to is a footgun.

- Don't try to read secrets back. They will be redacted. Don't try to flip
  flags or guess — there is no override. If you need the secret value, ask
  the user.

- Don't run commands while Vaxtly isn't running. The CLI exits with code 4
  and a clear message — tell the user to start the app, don't retry.

- Don't generate test data into the user's real collections without asking.
  Treat the collection tree as user-owned.

## Discovery checklist for a new task

When the user says "add this to vaxtly" or "update the X endpoint in vaxtly":

  1. \`vaxtly ping\`                              ← is the app running?
  2. \`vaxtly list collections\`                  ← what already exists?
  3. \`vaxtly list requests --collection-external-key <c>\`   ← inside the target collection
  4. If updating: \`vaxtly get request ...\`      ← read current state before writing
  5. \`vaxtly upsert request ...\`                ← create or partial update

## Exit codes (key these off in scripts)

  0  OK
  1  Generic error
  2  Validation / not-found (e.g. unknown external_key)
  3  Authentication failed — user may have restarted Vaxtly since CLI last ran
  4  Vaxtly is not running
  5  Conflict

## MCP mode

If you have access to MCP, prefer it over shell calls — \`vaxtly mcp\`
exposes the same operations as MCP tools (\`vaxtly_list_*\`, \`vaxtly_get_*\`,
\`vaxtly_upsert_*\`) with structured JSON schemas. Read tools carry the
\`readOnlyHint: true\` annotation so the client knows they're safe by default.

## Where things live (for the curious)

- Dotfile: \`~/.vaxtly/cli.json\` — mode 0600, per-session token and socket path.
- Socket: \`<userData>/agent.sock\` on macOS/Linux, named pipe on Windows.
- All communication is loopback-only (Unix socket / named pipe). No TCP,
  no browser-reachable surface. The token rotates every time the user
  restarts Vaxtly.
`

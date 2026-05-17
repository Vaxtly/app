# Vaxtly CLI

A small command-line tool (and MCP server) that lets you upsert collections, folders, requests, and environments into a running Vaxtly app from anywhere on your machine — including from AI coding agents.

The CLI talks to Vaxtly over a local Unix domain socket (or named pipe on Windows). No TCP, no browser-reachable surface. A per-launch token is written to `~/.vaxtly/cli.json` (mode 0600); the CLI reads it, the agent socket verifies it.

## Build

```
npm run build:cli
```

Outputs `cli/dist/index.js`. The compiled bundle is plain Node — runs outside Electron.

## Install

```
node cli/dist/index.js install-cli
```

Symlinks the binary into `~/.local/bin/vaxtly` (POSIX only in MVP). Make sure that directory is on your `$PATH`.

## Usage

Start Vaxtly first (the CLI errors with exit 4 if the app isn't running).

```
vaxtly upsert collection --external-key acme --name "Acme API"
vaxtly upsert folder    --collection-external-key acme --external-key auth --name "Auth"
vaxtly upsert request   --collection-external-key acme --external-key users.list \
                         --folder-external-key auth --name "List users" \
                         --method GET --url https://api.example.com/users \
                         --header 'X-Tenant: foo'
vaxtly upsert env       --external-key local --name Local \
                         --var 'API_KEY=dev-key' --var 'BASE_URL=http://localhost:3000'
```

All upserts are idempotent on `--external-key`. Re-running updates the existing entity; omitted fields are preserved.

## MCP mode

```
vaxtly mcp
```

Speaks MCP over stdio. Wire it into Claude Desktop / Cursor / any MCP-capable agent with:

```json
{ "mcpServers": { "vaxtly": { "command": "vaxtly", "args": ["mcp"] } } }
```

The MCP tools (`vaxtly_upsert_collection`, `vaxtly_upsert_folder`, `vaxtly_upsert_request`, `vaxtly_upsert_env`, `vaxtly_ping`) accept the same parameters as the CLI verbs, with proper JSON Schemas so an agent picks them up cleanly.

## Exit codes

| Code | Meaning                                |
|------|----------------------------------------|
| 0    | OK                                     |
| 1    | Generic error                          |
| 2    | Validation error / unknown parent      |
| 3    | Auth failed (stale token)              |
| 4    | Vaxtly is not running                  |
| 5    | Conflict                               |

Output is single-line JSON on stdout; human-readable errors go to stderr.

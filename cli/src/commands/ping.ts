import { loadConfig } from '../config'
import { rpc } from '../client'

export async function runPing(): Promise<void> {
  const result = await rpc(loadConfig(), 'ping', {})
  process.stdout.write(JSON.stringify(result) + '\n')
}

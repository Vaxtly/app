import { ipcMain } from 'electron'
import { IPC } from '../../shared/types/ipc'
import * as requestsRepo from '../database/repositories/requests'
import * as requestsActions from '../actions/requests'

export function registerRequestHandlers(): void {
  ipcMain.handle(IPC.REQUESTS_LIST, (_event, collectionId: string) => {
    return requestsRepo.findByCollection(collectionId)
  })

  ipcMain.handle(IPC.REQUESTS_GET, (_event, id: string) => {
    return requestsRepo.findById(id)
  })

  ipcMain.handle(IPC.REQUESTS_CREATE, (_event, data: { collection_id: string; name: string; folder_id?: string; method?: string; url?: string; body_type?: string }) => {
    return requestsActions.createRequest(data)
  })

  ipcMain.handle(IPC.REQUESTS_UPDATE, (_event, id: string, data: Record<string, unknown>) => {
    return requestsActions.updateRequest(id, data)
  })

  ipcMain.handle(IPC.REQUESTS_DELETE, (_event, id: string) => {
    return requestsActions.deleteRequest(id)
  })

  ipcMain.handle(IPC.REQUESTS_MOVE, (_event, id: string, targetFolderId: string | null, targetCollectionId?: string) => {
    return requestsActions.moveRequest(id, targetFolderId, targetCollectionId)
  })

  ipcMain.handle(IPC.REQUESTS_REORDER, (_event, ids: string[]) => {
    requestsActions.reorderRequests(ids)
  })
}

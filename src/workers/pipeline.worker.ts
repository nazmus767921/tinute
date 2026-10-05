import * as Comlink from 'comlink';
import { executePipeline } from '../pipeline/execute';
import type { WorkerJobPayload, WorkerJobResult, WorkerRpcApi } from './types';

const api: WorkerRpcApi = {
  async processJob(payload: WorkerJobPayload): Promise<WorkerJobResult> {
    const result = await executePipeline(payload.id, payload.buffer, payload.settings);
    if (result.ok) {
      // Transfer output ArrayBuffer back to the main thread via Transferable
      return Comlink.transfer(result, [result.value.outputBuffer]);
    }
    return result;
  },
};

Comlink.expose(api);

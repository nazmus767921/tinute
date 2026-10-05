import type {
  UserPipelineSettings,
  FinalPipelineOutput,
  PipelineError,
  Result,
} from '../pipeline/types';

export interface WorkerJobPayload {
  id: string;
  buffer: ArrayBuffer;
  settings: UserPipelineSettings;
}

export type WorkerJobResult = Result<FinalPipelineOutput, PipelineError>;

export interface WorkerRpcApi {
  processJob(payload: WorkerJobPayload): Promise<WorkerJobResult>;
}

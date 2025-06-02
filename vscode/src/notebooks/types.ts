

export interface NotebookJSON {
  nbformat?: number;
  nbformat_minor?: number;
  metadata?: Record<string, unknown>;
  cells: CellJSON[];
}

export interface CellJSON {
  cell_type: 'markdown' | 'code';
  source: string | string[];
  metadata?: Record<string, unknown>;
  outputs?: CellOutputJSON[];
  execution_count?: number;
}

export interface StreamOutputJSON {
  output_type: 'stream';
  text: string | string[];
}

export interface ErrorOutputJSON {
  output_type: 'error';
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

export interface DisplayDataOutputJSON {
  output_type: 'display_data' | 'execute_result';
  data?: MimeBundle;
  metadata?: Record<string, unknown>;
  execution_count?: number;
}

export type CellOutputJSON = StreamOutputJSON | ErrorOutputJSON | DisplayDataOutputJSON;

export type MimeBundle = { [mime: string]: string | string[] };
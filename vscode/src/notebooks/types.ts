export interface INotebook {
  nbformat: number;
  nbformat_minor: number;
  metadata: INotebookMetadata;
  cells: ICell[];
}

export interface INotebookMetadata {
  language_info?: {
    name: string;
    version?: string;
  };
  kernelspec?: {
    name: string;
    display_name?: string;
    language?: string;
  };
  [key: string]: unknown;
}

export type ICell = IMarkdownCell | ICodeCell | IRawCell;

interface IBaseCell {
  id: string;
  cell_type: string;
  metadata: IMetadata | undefined;
  source: string | string[];
}

export interface IMarkdownCell extends IBaseCell {
  cell_type: 'markdown';
}

export interface IRawCell extends IBaseCell {
  cell_type: 'raw';
}

export interface ICodeCell extends IBaseCell {
  cell_type: 'code';
  execution_count: number | null;
  outputs: IOutput[];
}

export type IOutput =
  | IStreamOutput
  | IErrorOutput
  | IDisplayDataOutput
  | IExecuteResultOutput;

export interface IStreamOutput {
  output_type: 'stream';
  name: 'stdout' | 'stderr';
  text: string | string[];
  metadata: IMetadata | undefined;
}

export interface IErrorOutput {
  output_type: 'error';
  ename: string;
  evalue: string;
  traceback: string[];
  metadata: IMetadata | undefined;
}

export interface IDisplayDataOutput {
  output_type: 'display_data';
  data: IMimeBundle;
  metadata: IMetadata | undefined;
}

export interface IExecuteResultOutput {
  output_type: 'execute_result';
  data: IMimeBundle;
  metadata: IMetadata | undefined;
  execution_count: number | null;
}

export interface IMimeBundle {
  [mime: string]: string | string[];
}

export interface IMetadata {
    [key: string]: unknown;
}
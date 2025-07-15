export interface IProcessedData {
  code?: string;
  name?: string;
  lastName?: string;
  ci?: string;
  type: 'credential' | 'identity';
}
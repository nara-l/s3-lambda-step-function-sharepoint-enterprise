export class WorkflowError extends Error {
  public readonly stepName: string;

  constructor(stepName: string, message: string) {
    super(message);
    this.name = 'WorkflowError';
    this.stepName = stepName;
  }
}

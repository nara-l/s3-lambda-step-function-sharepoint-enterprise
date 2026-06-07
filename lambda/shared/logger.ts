type LogFields = Record<string, string | number | boolean | undefined>;

export function logInfo(message: string, fields: LogFields = {}): void {
  console.log(
    JSON.stringify({
      level: 'info',
      message,
      ...fields,
    }),
  );
}

export function logError(message: string, fields: LogFields = {}): void {
  console.error(
    JSON.stringify({
      level: 'error',
      message,
      ...fields,
    }),
  );
}

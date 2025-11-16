export class Logger {
  static debug(message: string, ...args: any[]) {
    if (__DEV__) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  static info(message: string, ...args: any[]) {
    if (__DEV__) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  static error(message: string, error?: any) {
    if (__DEV__) {
      console.error(`[ERROR] ${message}`, error);
    }
  }

  static warn(message: string, ...args: any[]) {
    if (__DEV__) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }
}

import { Logger } from "../../application/ports/logger";

export class ConsoleLogger implements Logger {
  info(message: string, data?: Record<string, unknown>): void {
    console.log(JSON.stringify({ level: "INFO", message, ...data }));
  }

  error(message: string, data?: Record<string, unknown>): void {
    console.error(JSON.stringify({ level: "ERROR", message, ...data }));
  }
}

import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import path from "node:path";
import { formatWithOptions } from "node:util";

type ConsoleMethod = "debug" | "error" | "info" | "log" | "warn";

const methods: ConsoleMethod[] = ["debug", "error", "info", "log", "warn"];
const installedKey = Symbol.for("dearm.fileConsoleLogger.installed");
const writerKey = Symbol.for("dearm.fileConsoleLogger.writer");

interface LoggerGlobal {
  [installedKey]?: boolean;
  [writerKey]?: DailyLogWriter;
}

class DailyLogWriter {
  private currentDate = "";
  private disabled = false;
  private stream: WriteStream | null = null;

  constructor(private readonly logDir: string) {}

  write(line: string): void {
    if (this.disabled) return;

    try {
      const stream = this.getStream();
      stream.write(`${line}\n`);
    } catch (error) {
      this.disable(error);
    }
  }

  private getStream(): WriteStream {
    const date = localDate();
    if (this.stream && this.currentDate === date) return this.stream;

    this.stream?.end();
    mkdirSync(this.logDir, { recursive: true });
    this.currentDate = date;
    this.stream = createWriteStream(path.join(this.logDir, `${date}.log`), {
      flags: "a",
    });
    this.stream.on("error", (error) => this.disable(error));
    return this.stream;
  }

  private disable(error: unknown): void {
    if (this.disabled) return;
    this.disabled = true;
    this.stream?.destroy();
    this.stream = null;
    process.stderr.write(
      `[dearm] file logger disabled: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
  }
}

export function installFileConsoleLogger(): void {
  const globalState = globalThis as LoggerGlobal;
  if (globalState[installedKey]) return;
  globalState[installedKey] = true;

  const logDir = path.resolve(process.env.DEARM_LOG_DIR ?? "logs");
  const writer = new DailyLogWriter(logDir);
  globalState[writerKey] = writer;

  const originals = Object.fromEntries(
    methods.map((method) => [method, console[method].bind(console)]),
  ) as Record<ConsoleMethod, (...args: unknown[]) => void>;

  for (const method of methods) {
    console[method] = (...args: unknown[]) => {
      originals[method](...args);
      writer.write(formatLogLine(method, args));
    };
  }

  console.info(`[dearm] file logger writing to ${logDir}`);
}

function formatLogLine(method: ConsoleMethod, args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const message = formatWithOptions({ colors: false }, ...args);
  return `${timestamp} ${method.toUpperCase()} ${stripAnsi(message)}`;
}

function localDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function stripAnsi(value: string): string {
  const escapeChar = String.fromCharCode(27);
  return value.replace(new RegExp(`${escapeChar}\\[[0-9;]*m`, "g"), "");
}

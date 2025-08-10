import chalk from "chalk";

const debug = false;

type LogLevel = "Info" | "Warn" | "Error" | "Log" | "Debug";
type Source = "TW" | "YT";
type Status = "Success" | "Failure" | "Important";

const sourceColors: Record<Source, string> = {
  TW: "#9146FF",
  YT: "#FF0000",
};

const statusColors: Record<Status, typeof chalk> = {
  Success: chalk.greenBright,
  Failure: chalk.redBright,
  Important: chalk.blueBright,
};

const levelColors: Record<LogLevel, typeof chalk> = {
  Log: chalk.white,
  Debug: chalk.gray,
  Error: chalk.redBright,
  Info: chalk.blueBright,
  Warn: chalk.yellowBright,
};

function buildMessage(message: string, source?: Source, status?: Status) {
  const colored_source = source
    ? chalk.hex(sourceColors[source])(`[${source}]`)
    : "";
  const colored_colon = source ? chalk.hex(sourceColors[source])(`:`) : "";

  const statusSymbol = "●";
  const colored_status = status
    ? statusColors[status](`[${statusSymbol}]`)
    : "";

  return `${colored_status}${colored_source}${colored_colon} ${message}`;
}

export function log(
  message: string,
  level: LogLevel = "Log",
  source?: Source,
  status?: Status,
) {
  if (level === "Debug" && !debug) return;

  const msg = buildMessage(message, source, status);
  const colorFn = levelColors[level] || ((text: string) => text);

  console.log(colorFn(msg));
}

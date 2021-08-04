import { createLogger, format, transports } from "winston"
import { Confidant } from "../task"

export const getTestConfidantLogger = (silent = true) =>
  createLogger({
    level: "debug",
    ...(silent
      ? { silent: true }
      : {
          transports: [new transports.Console()],
          format: format.printf(({ message }) => message),
        }),
  })

export const getTestConfidant = (
  silent = true,
  timeout: string | undefined = undefined,
) =>
  ({
    logger: getTestConfidantLogger(silent),
    timeout,
  } as unknown as Confidant<any, any>)

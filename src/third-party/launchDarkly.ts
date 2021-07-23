import LD from "launchdarkly-node-server-sdk"
import { Confidant, Task, TaskMaker } from "../core/task"

interface LaunchDarklyContext {
  launchDarklyUser: {
    key: string
  }
}

let client: LD.LDClient
const getClient = async (
  launchDarklyKey: string,
  logger: LD.LDLogger,
): Promise<LD.LDClient> => {
  if (!client) {
    client = LD.init(launchDarklyKey, { logger })
  }

  await client.waitForInitialization()

  return client
}

class LaunchDarkly_<T> extends Task<LaunchDarklyContext, T> {
  constructor(
    confidant: Confidant<LaunchDarklyContext, Record<string, any>>,
    private launchDarklyKey: string,
    private key: string,
    private defaultValue: T,
  ) {
    super(confidant)
  }

  async initialize(): Promise<T> {
    const client = await getClient(this.launchDarklyKey, this.confidant.logger)

    return client.variation(
      this.key,
      this.confidant.context.launchDarklyUser,
      this.defaultValue,
    )
  }
}

export const LaunchDarkly =
  <T>(key: string, defaultValue: T) =>
  (launchDarklyKey: string): TaskMaker<LaunchDarklyContext, T> =>
  manager =>
    new LaunchDarkly_(manager, launchDarklyKey, key, defaultValue)

export type LaunchDarkly<T> = LaunchDarkly_<T>

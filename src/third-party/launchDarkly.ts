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
    public launchDarklyKey_: string,
    public key_: string,
    public defaultValue_: T,
  ) {
    super(confidant)
  }

  async initialize(): Promise<T> {
    const client = await getClient(
      this.launchDarklyKey_,
      this.confidant_.logger,
    )

    return client.variation(
      this.key_,
      this.confidant_.context.launchDarklyUser,
      this.defaultValue_,
    )
  }
}

export const LaunchDarkly =
  <T>(key: string, defaultValue: T) =>
  (launchDarklyKey: string): TaskMaker<LaunchDarklyContext, T> =>
  manager =>
    new LaunchDarkly_(manager, launchDarklyKey, key, defaultValue)

export type LaunchDarkly<T> = LaunchDarkly_<T>

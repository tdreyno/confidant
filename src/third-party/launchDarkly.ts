import LD from "launchdarkly-node-client-sdk"
import { Confidant, Task, TaskMaker } from "../core/task"

interface LaunchDarklyContext {
  launchDarklyUser: {
    key: string
  }
}

class LaunchDarkly_<T> extends Task<LaunchDarklyContext, T> {
  private client_: LD.LDClient

  constructor(
    confidant: Confidant<LaunchDarklyContext, Record<string, any>>,
    private launchDarklyKey: string,
    private key: string,
    private defaultValue: T,
  ) {
    super(confidant)

    this.client_ = LD.initialize(
      this.launchDarklyKey,
      this.confidant.context.launchDarklyUser,
      {
        streaming: true,
      },
    )
  }

  async getClient(): Promise<LD.LDClient> {
    await this.client_.waitForInitialization()

    return this.client_
  }

  async initialize(): Promise<T> {
    const client = await this.getClient()

    client.on("change", () => {
      this.set(client.variation(this.key, this.defaultValue))
    })

    return client.variation(this.key, this.defaultValue)
  }
}

export const LaunchDarkly =
  <T>(key: string, defaultValue: T) =>
  (launchDarklyKey: string): TaskMaker<LaunchDarklyContext, T> =>
  manager =>
    new LaunchDarkly_(manager, launchDarklyKey, key, defaultValue)

export type LaunchDarkly<T> = LaunchDarkly_<T>

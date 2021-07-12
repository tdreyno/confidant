import LD from "launchdarkly-node-client-sdk"
import { Confidant, Task, TaskMaker } from "../core/task"

interface LaunchDarklyContext {
  launchDarklyUser: {
    key: string
  }
}

class LaunchDarkly_<T> extends Task<LaunchDarklyContext, T> {
  private client_: LD.LDClient | undefined

  constructor(
    manager: Confidant<LaunchDarklyContext, any, Record<string, any>>,
    private launchDarklyKey: string,
    private key: string,
    private defaultValue: T,
  ) {
    super(manager)
  }

  getClient(key: string): Promise<LD.LDClient> {
    if (!this.client_) {
      this.client_ = LD.initialize(key, this.manager.context.launchDarklyUser, {
        streaming: true,
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.client_.waitForInitialization().then(() => this.client_!)
  }

  initialize(): Promise<T> {
    return this.getClient(this.launchDarklyKey).then(client => {
      client.on("change", () => {
        this.onUpdate(client.variation(this.key, this.defaultValue))
      })

      return client.variation(this.key, this.defaultValue)
    })
  }
}

export const LaunchDarkly =
  <T>(key: string, defaultValue: T) =>
  (launchDarklyKey: string): TaskMaker<LaunchDarklyContext, T> =>
  manager =>
    new LaunchDarkly_(manager, launchDarklyKey, key, defaultValue)

export type LaunchDarkly<T> = LaunchDarkly_<T>

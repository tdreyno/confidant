import { String } from "aws-sdk/clients/appstream"
import LD from "launchdarkly-node-client-sdk"
import { Manager, Task, TaskMaker } from "./task"

interface LaunchDarklyContext {
  launchDarklyUser: {
    key: String
  }
}

class LaunchDarkly_<T> extends Task<LaunchDarklyContext, T> {
  private client_: LD.LDClient | undefined

  constructor(
    manager: Manager<LaunchDarklyContext, any, Record<string, any>>,
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

    return this.client_.waitForInitialization().then(() => this.client_!)
  }

  initialize(): Promise<T> {
    return this.manager
      .get<string>("launchDarklyKey")
      .then(key => this.getClient(key))
      .then(client => {
        client.on("change", () => {
          this.onUpdate(client.variation(this.key, this.defaultValue))
        })

        return client.variation(this.key, this.defaultValue)
      })
  }
}

export const LaunchDarkly =
  <T>(key: string, defaultValue: T): TaskMaker<LaunchDarklyContext, T> =>
  manager =>
    new LaunchDarkly_(manager, key, defaultValue)

export type LaunchDarkly<T> = LaunchDarkly_<T>

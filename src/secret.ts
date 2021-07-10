import { SecretsManager } from "aws-sdk"
import { Manager, Task, TaskMaker } from "./task"

interface SecretContext {
  secretsManager: SecretsManager
}

class Secret_ extends Task<SecretContext, string> {
  constructor(
    manager: Manager<SecretContext, any, Record<string, any>>,
    private key: string,
    private refreshTimeout = Infinity,
  ) {
    super(manager)
  }

  initialize(): Promise<string> {
    return this.fetchSecret().then(data => {
      setTimeout(() => {
        this.fetchSecret().then(value => {
          this.onUpdate(value)
        })
      }, this.refreshTimeout)

      return data
    })
  }

  private fetchSecret(): Promise<string> {
    const { secretsManager } = this.manager.context

    return new Promise((resolve, reject) =>
      secretsManager.getSecretValue({ SecretId: this.key }, (err, data) => {
        if (err) {
          return reject(err)
        }

        if (data === undefined || data.SecretString === undefined) {
          return reject(`Invalid key: ${this.key}`)
        }

        return resolve(data.SecretString!)
      }),
    )
  }
}

export const Secret =
  (key: string, refreshTimeout = Infinity): TaskMaker<SecretContext, string> =>
  context =>
    new Secret_(context, key, refreshTimeout)

export type Secret = Secret_

import { SecretsManager } from "aws-sdk"
import { Confidant, Task, TaskMaker } from "../core/task"

interface AWSSecretContext {
  secretsManager: SecretsManager
}

class AWSSecret_ extends Task<AWSSecretContext, string> {
  constructor(
    manager: Confidant<AWSSecretContext, Record<string, any>>,
    private key: string,
    private refreshTimeout = Infinity,
  ) {
    super(manager)
  }

  initialize(): Promise<string> {
    return this.fetchSecret().then(data => {
      setTimeout(() => {
        void this.fetchSecret().then(value => {
          this.update(value)
        })
      }, this.refreshTimeout)

      return data
    })
  }

  private fetchSecret(): Promise<string> {
    const { secretsManager } = this.confidant.context

    return new Promise((resolve, reject) =>
      secretsManager.getSecretValue({ SecretId: this.key }, (err, data) => {
        if (err) {
          return reject(err)
        }

        if (data === undefined || data.SecretString === undefined) {
          return reject(`Invalid key: ${this.key}`)
        }

        return resolve(data.SecretString)
      }),
    )
  }
}

export const AWSSecret =
  (
    key: string,
    refreshTimeout = Infinity,
  ): TaskMaker<AWSSecretContext, string> =>
  context =>
    new AWSSecret_(context, key, refreshTimeout)

export type AWSSecret = AWSSecret_

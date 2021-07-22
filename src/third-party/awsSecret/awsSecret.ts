import { Confidant, Task, TaskMaker } from "../../core/task"
import { AWSManager } from "./awsManager"

export interface AWSSecretContext {
  awsManager: AWSManager
}

export class AWSSecret_<V = string> extends Task<AWSSecretContext, V> {
  constructor(
    confidant: Confidant<AWSSecretContext, Record<string, any>>,
    private key: string,
  ) {
    super(confidant)
  }

  async initialize(): Promise<V> {
    const { awsManager } = this.confidant.context

    return awsManager
      .fetch(this.key, () => {
        void this.fetch()
      })
      .then(string => this.decodeSecret(string))
      .then(data => this.validateSecretData(data))
  }

  async fetch(): Promise<V> {
    const { awsManager } = this.confidant.context

    const value = await awsManager
      .fetch(this.key, () => {
        void this.fetch()
      })
      .then(string => this.decodeSecret(string))
      .then(data => this.validateSecretData(data))

    this.set(value)

    return value
  }

  protected decodeSecret(data: string): unknown {
    return data
  }

  validateSecretData(data: unknown): V {
    return data as V
  }
}

export const AWSSecret =
  (key: string): TaskMaker<AWSSecretContext, string> =>
  context =>
    new AWSSecret_(context, key)

export type AWSSecret = AWSSecret_

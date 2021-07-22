import { Confidant, TaskMaker } from "../../core/task"
import { AWSSecret_, AWSSecretContext } from "./awsSecret"

class AWSJSONSecret_<V> extends AWSSecret_<V> {
  constructor(
    confidant: Confidant<AWSSecretContext, Record<string, any>>,
    key: string,
    private validate: (data: unknown) => V,
  ) {
    super(confidant, key)
  }

  decodeSecret(data: string): Record<string, unknown> {
    return JSON.parse(data)
  }

  validateSecretData(data: Record<string, unknown>): V {
    return this.validate(data)
  }
}

export const AWSJSONSecret =
  <V = Record<string, unknown>>(
    key: string,
    validate = (data: unknown): V => data as V,
  ): TaskMaker<AWSSecretContext, V> =>
  context =>
    new AWSJSONSecret_<V>(context, key, validate)

export type AWSJSONSecret<V = Record<string, unknown>> = AWSJSONSecret_<V>

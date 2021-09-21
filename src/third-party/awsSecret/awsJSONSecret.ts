import { Confidant, TaskMaker } from "../../core/task"
import { AWSSecret_, AWSSecretContext } from "./awsSecret"

class AWSJSONSecret_<V> extends AWSSecret_<V> {
  constructor(
    confidant: Confidant<AWSSecretContext, Record<string, any>>,
    key: string,
    public validate_: (data: unknown) => V,
  ) {
    super(confidant, key)
  }

  decodeSecret_(data: string): Record<string, unknown> {
    return JSON.parse(data)
  }

  validateSecretData(data: Record<string, unknown>): V {
    return this.validate_(data)
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

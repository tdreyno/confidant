import AWS from "aws-sdk"
import { Confidant } from "../../../core/task"
import { AWSSecret } from "../awsSecret"
import { AWSManager } from "../awsManager"

const mockGetSecretValue = jest.fn(
  ({ SecretId }: { SecretId: string }, callback) => {
    callback(null, { SecretString: `TEST-${SecretId}` })
  },
)

jest.mock("aws-sdk", () => {
  return {
    config: {
      update() {
        return {}
      },
    },

    SecretsManager: jest.fn(() => {
      return {
        getSecretValue: mockGetSecretValue,
      }
    }),
  }
})

const secretsManager = new AWS.SecretsManager({ region: "test" })
const awsManager = new AWSManager(secretsManager)

describe("AWSSecret", () => {
  beforeEach(() => {
    awsManager.clear()
  })

  it("should fetch from aws", async () => {
    mockGetSecretValue.mockImplementationOnce(
      ({ SecretId }: { SecretId: string }, callback) => {
        callback(null, { SecretString: `SUCCESS-${SecretId}` })
      },
    )

    const key = "test-key"
    const confidant = Confidant({ awsManager }, { [key]: AWSSecret(key) })

    const resultA = await confidant.runInitialize(key)

    expect(resultA).toBe(`SUCCESS-${key}`)
  })

  it("should error if result not a success", async () => {
    mockGetSecretValue.mockImplementationOnce((_, callback) => {
      callback("failed", {})
    })

    const key = "test-key"
    const confidant = Confidant({ awsManager }, { [key]: AWSSecret(key) })

    await expect(() => confidant.runInitialize(key)).rejects.toBe(`failed`)
  })

  it("should error if result not a string", async () => {
    mockGetSecretValue.mockImplementationOnce((_, callback) => {
      callback(null, {})
    })

    const key = "test-key"
    const confidant = Confidant({ awsManager }, { [key]: AWSSecret(key) })

    await expect(() => confidant.runInitialize(key)).rejects.toBe(
      `Invalid key: ${key}`,
    )
  })

  it("should refetch on a schedule", async () => {
    const awsManager1m = new AWSManager(secretsManager, "1m")

    const results = ["1", "2", "3"]
    mockGetSecretValue.mockImplementation(
      ({ SecretId }: { SecretId: string }, callback) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const result: string = results.shift()!

        callback(null, {
          SecretString: `SUCCESS-${SecretId}-${result}`,
        })
      },
    )

    const key = "test-key"

    const confidant = Confidant(
      { awsManager: awsManager1m },
      { [key]: AWSSecret(key) },
    )

    const onUpdate = jest.fn()

    const resultA = await confidant.runInitialize(key)
    expect(onUpdate).not.toHaveBeenCalled()
    expect(resultA).toBe(`SUCCESS-${key}-1`)

    const promiseA = new Promise(resolve => {
      confidant.onUpdate(key, value => {
        resolve(value)
        onUpdate(value)
      })
    })

    jest.advanceTimersByTime(60000)

    const resultB = await promiseA

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(resultB).toBe(`SUCCESS-${key}-2`)

    const promiseB = new Promise(resolve => {
      confidant.onUpdate(key, value => {
        resolve(value)
        onUpdate(value)
      })
    })

    jest.advanceTimersByTime(60000)

    const resultC = await promiseB

    expect(onUpdate).toHaveBeenCalledTimes(3) // 2 Updates. The first update runs twice, second once.
    expect(resultC).toBe(`SUCCESS-${key}-3`)
  })
})

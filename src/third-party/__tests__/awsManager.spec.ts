import AWS from "aws-sdk"
// import { timeout } from "../../util/timeout"
import { AWSManager } from "../awsSecret"

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

const KEY = "key"
const VALUE = "value"

describe("awsManager", () => {
  it("should clear", () => {
    const manager = new AWSManager(secretsManager)

    manager.set(KEY, VALUE)

    const resultA = manager.get(KEY)
    expect(resultA).toBe(VALUE)

    manager.clear()

    const resultB = manager.get(KEY)
    expect(resultB).toBeUndefined()
  })

  it("should get from cache hit", () => {
    const manager = new AWSManager(secretsManager)

    manager.set(KEY, VALUE)

    const resultA = manager.get(KEY)
    expect(resultA).toBe(VALUE)
  })

  it("should get undefined from cache miss", () => {
    const manager = new AWSManager(secretsManager)

    const resultB = manager.get(KEY)
    expect(resultB).toBeUndefined()
  })

  it("should set VALUE", () => {
    const manager = new AWSManager(secretsManager)

    manager.set(KEY, VALUE)

    const resultA = manager.get(KEY)
    expect(resultA).toBe(VALUE)
  })

  it("should set VALUE and clear old expiry", () => {
    const manager = new AWSManager(secretsManager, "5s")

    const onExpiry = jest.fn()

    manager.set(KEY, VALUE, () => {
      onExpiry()
    })

    const onExpiry2 = jest.fn()

    manager.set(KEY, VALUE + VALUE, () => {
      onExpiry2()
    })

    const resultA = manager.get(KEY)
    expect(resultA).toBe(VALUE + VALUE)

    jest.advanceTimersByTime(5000)

    expect(onExpiry).not.toHaveBeenCalled()
    expect(onExpiry2).toHaveBeenCalled()
  })

  // it("should immediately notifyOnExpiry when setting already expired VALUE", async () => {
  //   jest.useRealTimers()

  //   const expiredVALUE = sign({ foo: "bar" }, "secret", { expiresIn: "200ms" })

  //   try {
  //     await timeout(200)
  //   } catch (e) {}

  //   const manager = new AWSManager("0s")

  //   const onExpiry = jest.fn()

  //   manager.set("URL1", "username1", "password1", expiredVALUE, onExpiry)

  //   expect(onExpiry).toHaveBeenCalled()

  //   jest.useFakeTimers()
  // })

  // it("should notifyOnExpiry when VALUE expires", () => {
  //   const expiredVALUE = sign({ foo: "bar" }, "secret", { expiresIn: "10s" })

  //   const manager = new AWSManager("1s")

  //   const onExpiry = jest.fn()

  //   manager.set(KEY, expiredVALUE, onExpiry)

  //   expect(onExpiry).not.toHaveBeenCalled()

  //   jest.advanceTimersByTime(10000)

  //   expect(onExpiry).toHaveBeenCalled()
  // })

  // it("should know if a VALUE is expired", () => {
  //   const manager = new AWSManager(secretsManager)

  //   const expiredVALUE1 = sign({ foo: "bar1" }, "secret", { expiresIn: "-10m" })
  //   expect(manager.isExpired(expiredVALUE1)).toBeTruthy()

  //   const expiredVALUE2 = sign({ foo: "bar2" }, "secret", { expiresIn: "10m" })
  //   expect(manager.isExpired(expiredVALUE2)).toBeFalsy()
  // })

  it("should notifyOnExpiry when VALUE expires even if it is set twice", () => {
    const expiredVALUE1 = VALUE
    const expiredVALUE2 = VALUE + VALUE

    const manager = new AWSManager(secretsManager, "5s")

    const onExpiry = jest.fn()

    manager.set(KEY, expiredVALUE1, onExpiry)
    manager.set(KEY, expiredVALUE2, onExpiry)

    expect(onExpiry).not.toHaveBeenCalled()

    jest.advanceTimersByTime(2000)

    expect(onExpiry).not.toHaveBeenCalled()

    jest.advanceTimersByTime(3000)

    expect(onExpiry).toHaveBeenCalledTimes(1)
  })

  it("should remove VALUE", () => {
    const manager = new AWSManager(secretsManager)

    manager.set(KEY, VALUE)

    const resultA = manager.get(KEY)
    expect(resultA).toBe(VALUE)

    manager.remove(KEY)

    const resultB = manager.get(KEY)
    expect(resultB).toBeUndefined()
  })

  it("should remove VALUE and clear timeout", () => {
    const manager = new AWSManager(secretsManager, "5s")

    const onExpiry = jest.fn()

    manager.set(KEY, VALUE, () => {
      onExpiry()
    })

    const resultA = manager.get(KEY)
    expect(resultA).toBe(VALUE)

    manager.remove(KEY)

    const resultB = manager.get(KEY)
    expect(resultB).toBeUndefined()

    jest.advanceTimersByTime(5000)

    expect(onExpiry).not.toHaveBeenCalled()
  })
})

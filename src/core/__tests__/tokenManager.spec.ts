import { sign } from "jsonwebtoken"
import { wait } from "../../util/timeout"
import { TokenManager } from "../tokenManager"

const JWT = sign({ foo: "bar" }, "secret")

describe("TokenManager", () => {
  it("should clear", () => {
    const manager = new TokenManager()

    manager.set("test-key", JWT)

    const resultA = manager.get("test-key")
    expect(resultA).toBe(JWT)

    manager.clear()

    const resultB = manager.get("test-key")
    expect(resultB).toBeUndefined()
  })

  it("should get from cache hit", () => {
    const manager = new TokenManager()

    manager.set("test-key", JWT)

    const resultA = manager.get("test-key")
    expect(resultA).toBe(JWT)
  })

  it("should get undefined from cache miss", () => {
    const manager = new TokenManager()

    const resultB = manager.get("test-key2")
    expect(resultB).toBeUndefined()
  })

  it("should set JWT", () => {
    const manager = new TokenManager()

    manager.set("test-key", JWT)

    const resultA = manager.get("test-key")
    expect(resultA).toBe(JWT)
  })

  it("should immediately notifyOnExpiry when setting already expired JWT", () => {
    const expiredJWT = sign({ foo: "bar" }, "secret", { expiresIn: "200ms" })

    const manager = new TokenManager("0s")

    const onExpiry = jest.fn()

    manager.set("test-key", expiredJWT, onExpiry)

    expect(onExpiry).toHaveBeenCalled()
  })

  it("should notifyOnExpiry when JWT expires", async () => {
    const expiredJWT = sign({ foo: "bar" }, "secret", { expiresIn: "2s" })

    const manager = new TokenManager("1s")

    const onExpiry = jest.fn()

    manager.set("test-key", expiredJWT, onExpiry)

    expect(onExpiry).not.toHaveBeenCalled()

    await wait(2000)

    expect(onExpiry).toHaveBeenCalled()
  })

  it("should notifyOnExpiry when JWT expires even if it is set twice", async () => {
    const expiredJWT1 = sign({ foo: "bar1" }, "secret", { expiresIn: "2s" })
    const expiredJWT2 = sign({ foo: "bar2" }, "secret", { expiresIn: "4s" })

    const manager = new TokenManager("0s")

    const onExpiry = jest.fn()

    manager.set("test-key", expiredJWT1, onExpiry)
    manager.set("test-key", expiredJWT2, onExpiry)

    expect(onExpiry).not.toHaveBeenCalled()

    await wait(2000)

    expect(onExpiry).not.toHaveBeenCalled()

    await wait(2000)

    expect(onExpiry).toHaveBeenCalledTimes(1)
  })

  it("should remove JWT", () => {
    const manager = new TokenManager()

    manager.set("test-key", JWT)

    const resultA = manager.get("test-key")
    expect(resultA).toBe(JWT)

    manager.remove("test-key")

    const resultB = manager.get("test-key")
    expect(resultB).toBeUndefined()
  })
})

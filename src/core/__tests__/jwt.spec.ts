import { rest } from "msw"
import { setupServer } from "msw/node"
import { sign } from "jsonwebtoken"
import fetch from "node-fetch"
import { JWTManager } from "../jwtManager"
import { JWT } from "../jwt"
import { Confidant } from "../task"
import { wait } from "../../util/timeout"
import { getTestConfidant } from "./confidantStub"

const server = setupServer()

describe("JWT", () => {
  beforeAll(() => server.listen())

  afterEach(() => {
    server.resetHandlers()
  })

  afterAll(() => server.close())

  it("should allow custom implementation of fetch", async () => {
    const URL = "http://test/get-jwt"

    const jwt = sign({ hello: "world" }, "secret", { expiresIn: "100ms" })

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        return res(ctx.status(200), ctx.text(jwt))
      }),
    )

    const manager = new JWTManager()

    type TestJWTData = any
    class TestJWT extends JWT {
      constructor(confidant: Confidant<TestJWTData, Record<string, any>>) {
        super(confidant, "test-cache-key", manager)
      }

      async fetchJWT(): Promise<string> {
        const res = await fetch(URL, {
          method: "POST",
        })
        return res.text()
      }
    }

    const task = new TestJWT(getTestConfidant())
    const result = await task.runInitialize()
    expect(result).toBe(jwt)
  })

  it("should pull token from cache if already fetched", async () => {
    const URL = "http://test/get-jwt"

    const jwt = sign({ hello: "world" }, "secret", { expiresIn: "10m" })

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        await wait(1000)

        return res(ctx.status(200), ctx.text(jwt))
      }),
    )

    const manager = new JWTManager()

    type TestJWTData = any
    class TestJWT extends JWT {
      constructor(
        confidant: Confidant<TestJWTData, Record<string, any>>,
        cacheKey: string,
      ) {
        super(confidant, cacheKey, manager)
      }

      async fetchJWT(): Promise<string> {
        const res = await fetch(URL, {
          method: "POST",
        })

        return res.text()
      }
    }

    const onInitB = jest.fn()

    const taskA = new TestJWT(getTestConfidant(), "key1")
    const taskB = new TestJWT(getTestConfidant(), "key1")

    taskB.onInitialize(onInitB)

    await taskA.runInitialize()

    const before = Date.now()
    await taskB.runInitialize()
    const after = Date.now()

    expect(after - before).toBeLessThan(10)
  })

  it("should update when jwt expires", async () => {
    const URL = "http://test/get-jwt"

    const confidant = getTestConfidant()
    const expiresIn = 3

    const getJWT = (num: string, expiresIn: number) =>
      sign({ num }, "secret", { expiresIn })

    const values = [getJWT("first", expiresIn), getJWT("second", 10000)]
    const jwts = [...values]

    const onPost = jest.fn()

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const jwt = values.shift()!
        onPost(jwt)
        return res(ctx.status(200), ctx.text(jwt))
      }),
    )

    const manager = new JWTManager("0s")

    class TestJWT extends JWT {
      constructor(confidant: Confidant<any, Record<string, any>>) {
        super(confidant, "test-key", manager, {
          onRetry: err => {
            this.logger.error(err)
          },
        })
      }

      async fetchJWT(): Promise<string> {
        const res = await fetch(URL, {
          method: "POST",
        })

        return res.text()
      }
    }

    const task = new TestJWT(confidant)

    const onUpdate = jest.fn()

    task.onUpdate(value => {
      onUpdate(value)
    })

    expect(onPost).toHaveBeenCalledTimes(0)
    const resultA = await task.runInitialize()

    expect(onUpdate).toHaveBeenCalledTimes(0)
    expect(resultA).toBe(jwts[0])
    expect(onPost).toHaveBeenCalledWith(jwts[0])
    expect(onPost).toHaveBeenCalledTimes(1)

    confidant.logger.debug(`Advancing time by ${expiresIn * 1000}`)
    await wait(expiresIn * 1000)

    const resultB2 = await task.get()

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(resultB2).toBe(jwts[1])
    expect(onPost).toHaveBeenCalledWith(jwts[1])
    expect(onPost).toHaveBeenCalledTimes(2)

    const resultB = await task.get()

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(resultB).toBe(jwts[1])
    expect(onPost).toHaveBeenCalledTimes(2)

    task.destroy()
  })

  it("should update when manually invalidated", async () => {
    const URL = "http://test/get-jwt"

    const expiresIn = 600

    const getJWT = (num: string) => sign({ num }, "secret", { expiresIn })

    const values = ["1", "2"].map(getJWT)
    const jwts = [...values]

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const jwt = values.shift()!
        return res(ctx.status(200), ctx.text(jwt))
      }),
    )

    const manager = new JWTManager()

    class TestJWT extends JWT {
      constructor(confidant: Confidant<any, Record<string, any>>) {
        super(confidant, "test-key", manager)
      }

      async fetchJWT(): Promise<string> {
        const res = await fetch(URL, {
          method: "POST",
        })

        return res.text()
      }
    }

    const task = new TestJWT(getTestConfidant())
    const resultA = await task.runInitialize()

    expect(resultA).toBe(jwts[0])

    const resultB = await task.invalidate()

    expect(resultB).toBe(jwts[1])
  })

  it("should retry failed requests", async () => {
    const URL = "http://test/get-jwt"

    const getJWT = (num: number) => sign({ num }, "secret")
    const jwt = getJWT(5)

    const values = [500, 400, 200]

    const on500 = jest.fn()
    const on400 = jest.fn()
    const on200 = jest.fn()
    const onRetry = jest.fn()

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const status = values.shift()!

        switch (status) {
          case 500:
            on500()
            break

          case 400:
            on400()
            break

          case 200:
            on200()
            break
        }

        return res(ctx.status(status), ctx.text(status === 200 ? jwt : "Error"))
      }),
    )

    const manager = new JWTManager()

    class TestJWT extends JWT {
      constructor(confidant: Confidant<any, Record<string, any>>) {
        super(confidant, "test-cache-key", manager, {
          randomize: false,
          minTimeout: 100,
          onRetry,
        })
      }

      async fetchJWT(): Promise<string> {
        const res = await fetch(URL, {
          method: "POST",
        })

        if (res.status !== 200) {
          throw new Error("Error")
        }

        return res.text()
      }
    }

    const task = new TestJWT(getTestConfidant())
    const promiseA = task.runInitialize()

    const resultA = await promiseA
    expect(resultA).toBe(jwt)

    expect(on500).toHaveBeenCalledTimes(1)
    expect(on400).toHaveBeenCalledTimes(1)
    expect(on200).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledTimes(2)
  })

  it("should retry failed requests but eventually fail", async () => {
    const URL = "http://test/get-jwt"

    const onRetry = jest.fn()

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        return res(ctx.status(500), ctx.text("Error"))
      }),
    )

    const manager = new JWTManager()

    type TestJWTData = any
    class TestJWT extends JWT {
      constructor(confidant: Confidant<TestJWTData, Record<string, any>>) {
        super(confidant, "test-cache-key", manager, {
          randomize: false,
          retries: 3,
          minTimeout: 100,
          onRetry,
        })
      }

      async fetchJWT(): Promise<string> {
        const res = await fetch(URL, {
          method: "POST",
        })

        if (res.status !== 200) {
          throw new Error("Error")
        }

        return await res.text()
      }
    }

    const task = new TestJWT(getTestConfidant())
    const promiseA = task.runInitialize()

    await expect(() => promiseA).rejects.toBeInstanceOf(Error)
    expect(onRetry).toHaveBeenCalledTimes(3)
  })
})

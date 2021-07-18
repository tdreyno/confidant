import { rest } from "msw"
import jwt from "jsonwebtoken"
import Singleton, { requestJWT } from "../tokenManager"
import { Token } from "../token"
import { Confidant } from "../task"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { server } = require("../../__tests__/server")

describe("Token", () => {
  beforeEach(() => {
    Singleton.clear()
  })

  it("should allow implementations to requestJWT", async () => {
    const URL = "http://test/get-token"

    const token = jwt.sign({ foo: "bar" }, "secret")

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        return res(ctx.status(200), ctx.text(token))
      }),
    )

    const result = await requestJWT(URL, "username", "password")

    expect(result).toBe(token)
  })

  it("should error when requestJWT returns an empty string", async () => {
    const URL = "http://test/get-token"

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        return res(ctx.status(200), ctx.text(""))
      }),
    )

    expect.assertions(1)

    await expect(async () => {
      await requestJWT(URL, "username", "password")
    }).rejects.toBeInstanceOf(Error)
  })

  it("should allow custom implementation of fetch", async () => {
    const URL = "http://test/get-token"

    const token = jwt.sign({ hello: "world" }, "secret", { expiresIn: 100 })

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        return res(ctx.status(200), ctx.text(token))
      }),
    )

    type TestTokenData = { exp: number; hello: string }
    class TestToken extends Token<TestTokenData> {
      constructor(manager: Confidant<TestTokenData, Record<string, any>>) {
        super(manager)
      }

      fetchToken(): Promise<string> {
        return requestJWT(URL, "username", "password")
      }
    }

    const task = new TestToken(null as any)
    const result = await task.runInitialize()
    expect(result).toMatchObject({ hello: "world" })
  })

  it("should allow custom decoding of token string", async () => {
    const URL = "http://test/get-token"

    const token = jwt.sign({ num: "1" }, "secret", { expiresIn: 100 })

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        return res(ctx.status(200), ctx.text(token))
      }),
    )

    type TestTokenData = { exp: number; num: number }
    class TestToken extends Token<TestTokenData> {
      constructor(manager: Confidant<TestTokenData, Record<string, any>>) {
        super(manager)
      }

      fetchToken(): Promise<string> {
        return requestJWT(URL, "username", "password")
      }

      decodeToken(token: string): TestTokenData {
        const decoded = jwt.decode(token) as Record<string, unknown>

        return {
          ...decoded,
          num: parseInt((decoded.num as string) ?? "0", 10),
        } as TestTokenData
      }
    }

    const task = new TestToken(null as any)
    const result = await task.runInitialize()
    expect(result).toMatchObject({ num: 1 })
  })

  it("should update when token expires", async () => {
    const URL = "http://test/get-token"

    const expiresIn = 600

    const getToken = (num: string) => jwt.sign({ num }, "secret", { expiresIn })

    const values = ["1", "2"]

    server.use(
      rest.post(URL, async (_req, res, ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const value = values.shift()!
        const token = getToken(value)
        return res(ctx.status(200), ctx.text(token))
      }),
    )

    type TestTokenData = { exp: number; num: string }
    class TestToken extends Token<TestTokenData> {
      constructor(manager: Confidant<TestTokenData, Record<string, any>>) {
        super(manager)
      }

      fetchToken(): Promise<string> {
        return requestJWT(URL, "username", "password", this.manager, () => {
          this.manager.remove(URL, "username", "password")

          void this.retryFetchToken().then(token => {
            this.update(token)
          })
        })
      }
    }

    const task = new TestToken(null as any)
    const resultA = await task.runInitialize()

    expect(resultA).toMatchObject({ num: "1" })

    const onUpdate = jest.fn()

    const promise = new Promise(resolve => {
      task.onUpdate(value => {
        resolve(value)
        onUpdate(value)
      })
    })

    jest.advanceTimersByTime(expiresIn * 1000)

    const resultB2 = await promise

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(resultB2).toMatchObject({ num: "2" })

    const resultB = await task.get()

    expect(resultB).toMatchObject({ num: "2" })
  })

  pending("should retry failed requests")
  pending("should eventually error if retry fails")
})

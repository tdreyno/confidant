import { rest } from "msw"
import jwt from "jsonwebtoken"
import { requestJWT, Token } from "../token"
import { Confidant } from "../task"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { server } = require("../../__tests__/server")

describe("Token", () => {
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

    const token = jwt.sign({ exp: 100, hello: "world" }, "secret")

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

      decodeToken(token: string): TestTokenData {
        return jwt.decode(token) as unknown as TestTokenData
      }
    }

    const task = new TestToken(null as any)
    const result = await task.runInitialize()
    expect(result).toMatchObject({ exp: 100 })
  })

  it("should allow custom decoding of token string", async () => {
    const URL = "http://test/get-token"

    const token = jwt.sign({ exp: 100, num: "1" }, "secret")

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

  pending("should know when token expires")
  pending("should update when token expires")
  pending("should retry failed requests")
  pending("should eventually error if retry fails")
})

import { rest } from "msw"
import fetch from "node-fetch"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { server } = require("../../__tests__/server")

describe("Token", () => {
  it("should", async () => {
    server.use(
      rest.post("http://test/hello", async (_req, res, ctx) => {
        return res(ctx.status(200), ctx.json({ message: "hi" }))
      }),
    )

    const result = await fetch("http://test/hello", {
      method: "POST",
    }).then(res => res.json())
    console.log(result)
  })

  pending("should allow implementations to requestJWT")
  pending("should allow custom implementation of fetch")
  pending("should allow custom decoding of token string")
  pending("should know when token expires")
  pending("should update when token expires")
  pending("should retry failed requests")
  pending("should eventually error if retry fails")
})

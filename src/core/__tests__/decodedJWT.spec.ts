import { sign } from "jsonwebtoken"
import { DecodedJWT } from "../decodedJWT"
import { TEST_CONFIDANT } from "./jwt.spec"

describe("DecodedJWT", () => {
  it("should allow custom decoding of jwt string", async () => {
    interface DecodedData {
      num: number
    }

    const validator = (decoded: any): DecodedData => ({
      ...decoded,
      num: parseInt((decoded.num as string) || "0", 10),
    })

    const jwt = sign({ num: "1" }, "secret", { expiresIn: "100ms" })

    const boundDecoder = DecodedJWT(validator)
    const taskMaker = boundDecoder(jwt)
    const task = taskMaker(TEST_CONFIDANT)
    const result = await task.runInitialize()

    expect(result).toMatchObject({ num: 1 })
  })
})

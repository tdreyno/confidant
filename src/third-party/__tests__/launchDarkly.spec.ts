import { Confidant } from "../../core/task"
import { LaunchDarkly } from "../launchDarkly"
import { Hardcoded, Inputs } from "../../core/index"

const mockVariation = jest.fn((key: string) => {
  return `${key}-RESULT`
})

const mockOn = jest.fn()

jest.mock("launchdarkly-node-client-sdk", () => {
  return {
    initialize: jest.fn(() => ({
      on: mockOn,
      waitForInitialization: jest.fn().mockResolvedValue(void 0),
      variation: mockVariation,
    })),
  }
})

describe("LaunchDarkly", () => {
  it("should get a feature", async () => {
    const key = "test-key"

    const confidant = Confidant(
      {
        launchDarklyUser: {
          key: "USERID",
        },
      },
      {
        launchDarklyKey: Hardcoded("LDKEY FROM AWS"),
        [key]: Inputs("launchDarklyKey").chain(
          LaunchDarkly(key, "default-value"),
        ),
      },
    )

    await confidant.initialize()
    const resultA = await confidant.get(key)

    expect(resultA).toBe(`${key}-RESULT`)
  })

  it("should get two feature2", async () => {
    const key1 = "test-key1"
    const key2 = "test-key2"

    const confidant = Confidant(
      {
        launchDarklyUser: {
          key: "USERID",
        },
      },
      {
        launchDarklyKey: Hardcoded("LDKEY FROM AWS"),
        [key1]: Inputs("launchDarklyKey").chain(
          LaunchDarkly(key1, "default-value1"),
        ),
        [key2]: Inputs("launchDarklyKey").chain(
          LaunchDarkly(key2, "default-value2"),
        ),
      },
    )

    await confidant.initialize()
    const result1 = await confidant.get(key1)
    expect(result1).toBe(`${key1}-RESULT`)

    const result2 = await confidant.get(key2)
    expect(result2).toBe(`${key2}-RESULT`)
  })

  it("should update when the feature changes", async () => {
    const key = "test-key"

    mockOn.mockImplementationOnce((_, callback) => {
      setTimeout(() => {
        callback(`${key}-RESULT2`)
      }, 2000)
    })

    const confidant = Confidant(
      {
        launchDarklyUser: {
          key: "USERID",
        },
      },
      {
        launchDarklyKey: Hardcoded("LDKEY FROM AWS"),
        [key]: Inputs("launchDarklyKey").chain(
          LaunchDarkly(key, "default-value"),
        ),
      },
    )

    const result = await confidant.initialize()

    expect(result[key]).toBe(`${key}-RESULT`)

    jest.advanceTimersByTime(2000)

    // const resultB = await confidant.get(key)
    // expect(resultB).toBe(`${key}-RESULT2`)
  })
})

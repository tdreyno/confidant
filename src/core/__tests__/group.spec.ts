import { wait } from "../../util/timeout"
import { Group } from "../group"
import { Hardcoded } from "../hardcoded"
import { Inputs } from "../inputs"
import { Confidant } from "../task"
import { Echo } from "./echo"

describe("Group", () => {
  it("should combine multiple tasks", async () => {
    const confidant = Confidant(null as any, {
      group: Group({
        taskA: Echo(1),
        taskB: Hardcoded(5),
      }),
    })

    const results = await confidant.initialize()

    expect(results).toMatchObject({
      group: {
        taskA: 1,
        taskB: 5,
      },
    })
  })

  it("should allow chaining within the subtasks", async () => {
    const confidant = Confidant(null as any, {
      group: Group({
        taskA: Echo(5),
        taskB: Inputs("taskA").chain(a => Echo(a * 2)),
      }),
    })

    const results = await confidant.initialize()

    expect(results).toMatchObject({
      group: {
        taskA: 5,
        taskB: 10,
      },
    })
  })

  it("should update when a subtask updates", async () => {
    const onUpdate = jest.fn()

    const confidant = Confidant(null as any, {
      group: Group({
        taskA: Echo(5),
      }),
    })

    confidant.onUpdate("group", onUpdate)

    await confidant.runInitialize("group")

    // nestedConfidant is private, so we force it
    const g = confidant.tasks.group as any
    const c = g.nestedConfidant as Confidant<any, any>
    c.tasks.taskA.update((n: any) => n * 2)

    await wait(100)

    const result = await confidant.get("group")

    expect(result).toMatchObject({ taskA: 10 })
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })

  it("should be able to merge groups", async () => {
    const defaultTasks = Group({
      taskA: Echo(5),
      taskB: Hardcoded(5),
    })

    const confidant = Confidant(null as any, {
      group: Group({
        ...defaultTasks.tasks,
        taskB: Inputs("taskA").chain(a => Hardcoded(a * 2)),
      }),
    })

    const results = await confidant.initialize()

    expect(results).toMatchObject({
      group: {
        taskA: 5,
        taskB: 10,
      },
    })
  })
})

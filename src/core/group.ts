// import { Confidant, Task, TaskMaker } from "./task"

// export class Group_<C, V> extends Task<C, V> {
//   private nestedConfidant: Confidant<C, Record<string, any>>

//   constructor(
//     confidant: Confidant<C, Record<string, any>>,
//     nested: Record<string, TaskMaker<C, any>>,
//   ) {
//     super(confidant)

//     this.nestedConfidant = Confidant(this.confidant.context, nested)
//   }

//   initialize(): Promise<V> {
//     // Bind updates for nested
//     return this.nestedConfidant.initialize()
//   }
// }

// export const Group =
//   <C, V>(nested: Record<string, TaskMaker<C, any>>) =>
//   (manager: Confidant<C, Record<string, any>>) =>
//     new Group_(manager, nested)

// export type Group<C, V> = Group_<C, V>

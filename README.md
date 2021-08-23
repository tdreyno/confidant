# Confidant

[![Test Coverage](https://api.codeclimate.com/v1/badges/bade509a61c126d7f488/test_coverage)](https://codeclimate.com/github/tdreyno/confidant/test_coverage)
[![npm latest version](https://img.shields.io/npm/v/@tdreyno/confidant/latest.svg)](https://www.npmjs.com/package/@tdreyno/confidant)

Confidant is a library for storing environmental variables, secrets, feature flags and tokens so all can be easily access throughout your JavaScript/TypeScript project.

## Install

```bash
yarn add @tdreyno/confidant
```

## Basic Usage

```typescript
import { SecretsManager } from "aws-sdk"
import {
  Confidant,
  AWSSecret,
  Hardcoded as _,
  LaunchDarkly,
  Inputs,
  Group,
  AWSManager,
} from "@tdreyno/confidant"

const results = await Confidant(
  {
    awsManager: new AWSManager(new SecretsManager({ region: "ap-south-1" })),
  },
  {
    ...DEV,
    url: _("/prod"),
    anotherThing: AWSSecret("MyViasat-TSUsage/PSM/serviceAccount/PROD"),

    launchDarklyKey: AWSSecret("LDKEY FROM AWS"),
    featureA: Inputs("launchDarklyKey").chain(
      LaunchDarkly("feature-a", "default-value"),
    ),

    items: Group({
      first: _(1),
      last: _(1_000_000),
    }),
  },
).initialize()

console.log(results.url)

console.log(results.featureA)
```

### Built-in Tasks

- `Hardcoded` (often aliased as `_`): A task which always returns a hard-coded value.
- `AWSSecret`: A task which loads a **string** secret from AWS Secret Manager. Must include an instance of `awsManager` in the `Confidant` context.
- `AWSJSONSecret`: A task which loads a **JSON** secret from AWS Secret Manager. Must include an instance of `awsManager` in the `Confidant` context.
- `LaunchDarkly`: A task which loads a feature flag when provided a `launchDarklyUser` object in the `Confidant` context.
- `Token` is an abstract base class. Create custom Token tasks by inheriting from it and implementing the `fetchToken` method which returns a `Promise<string>`
- `DecodedJWT` is a task which takes a JWT string and a function for converting the decoded object into a typed and validated data structure.
- `Inputs` is a task which listens to other tasks by key name. When all those tasks are loaded (or updated), pass the values to a dependent task via `.chain`. Allows composition of tasks.
- `Group` is a task which groups a set of tasks into a single object.

### Add Logger

Provide a [winston logger](https://github.com/winstonjs/winston) as the 3rd parameter to `Confidant`. Can be accessed as `this.logger` in custom Tasks.

Can be used to forward logs to 3rd party logging platforms.

```typescript
import { createLogger, transports } from "winston"
import { Confidant, Task } from "@tdreyno/confidant"

class MyToken extends Token<MyTokenData> {
  constructor(
    confidant: Confidant<MyTokenData, Record<string, any>>,
    private url: string,
    private username: string,
    private password: string,
  ) {
    super(confidant)
  }

  fetchToken(): Promise<string> {
    this.logger.log("My message")

    return fetch(this.url)
  }
}

const results = await Confidant(
  {},
  {
    myToken: c => new MyToken(c, "url", "username", "password"),
  },
  {
    logger: createLogger({
      transports: [new transports.Console()],
    }),
  },
).initialize()

console.log(results.myToken)
```

### Invalidate JWT

```typescript
import { Confidant } from "@tdreyno/confidant"

const confidant = Confidant(
  {},
  {
    myJWT: MyJWT("url", "username", "password"),
  },
)

const results = await confidant.initialize()

const newValue = await confidant.invalidate("myJWT")
```

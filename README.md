# Confidant

[![Test Coverage](https://api.codeclimate.com/v1/badges/bade509a61c126d7f488/test_coverage)](https://codeclimate.com/github/tdreyno/confidant/test_coverage)
[![npm latest version](https://img.shields.io/npm/v/@tdreyno/confidant/latest.svg)](https://www.npmjs.com/package/@tdreyno/confidant)

Confidant is a library for storing environmental variables, secrets, feature flags and tokens so all can be easily access throughout your JavaScript/TypeScript project.

## Install

```bash
yarn add @tdreyno/confidant
```

## Usage

```typescript
import { SecretsManager } from "aws-sdk"
import {
  Confidant,
  AWSSecret,
  Hardcoded as _,
  LaunchDarkly,
  Inputs,
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
  },
)

console.log(results.url)

console.log(results.featureA)
```

### Add Logger

Provide a [winston logger](https://github.com/winstonjs/winston) as the 3rd parameter to `Confidant`. Can be accessed as `this.logger` in custom Tasks.

Can be used to forward logs to 3rd party logging platforms.

```typescript
import winston from "winston"
import { Confidant, Task } from "@tdreyno/confidant"

class MyToken extends JWT<MyTokenData> {
  constructor(
    confidant: Confidant<MyTokenData, Record<string, any>>,
    private url: string,
    private username: string,
    private password: string,
  ) {
    super(confidant)
  }

  fetchJWT(): Promise<string> {
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
    logger: new winston.createLogger({
      transports: [new winston.transports.Console()],
    }),
  },
).initialize()

console.log(results.myToken)
```

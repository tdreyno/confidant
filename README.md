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

console.log(confidant.url)

console.log(confidant.featureA)
```

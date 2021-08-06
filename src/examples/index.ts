import { SecretsManager } from "aws-sdk"
import {
  Confidant,
  AWSSecret,
  Hardcoded as _,
  LaunchDarkly,
  Inputs,
  AWSManager,
  Group,
} from "../index"

// const ViceToken = 5 as any
const DEV = {
  url: _("/dev"),
  psmServiceAccount: AWSSecret("MyViasat-TSUsage/PSM/serviceAccount"),
  anotherThing: AWSSecret("MyViasat-TSUsage/PSM/serviceAccount/DEV"),

  launchDarklyKey: AWSSecret("LDKEY FROM AWS"),
  featureA: Inputs("launchDarklyKey").chain(
    LaunchDarkly("feature-a", "default-value"),
  ),

  service: Group({
    url: _("/dev"),
    creds: AWSSecret("service-creds"),
  }),
}

const PROD = {
  ...DEV,
  url: _("/prod"),
  anotherThing: AWSSecret("MyViasat-TSUsage/PSM/serviceAccount/PROD"),
}

void Confidant(
  {
    awsManager: new AWSManager(new SecretsManager({ region: "ap-south-1" })),
  },
  PROD,
)
  .initialize()
  .then(confidant => {
    confidant.featureA
    confidant.anotherThing
    confidant.url
    confidant.service.creds
  })

import { SecretsManager } from "aws-sdk"
import {
  AWSSecret,
  Hardcoded as _,
  LaunchDarkly,
  Inputs,
  AWSManager,
} from "../index"
import { ViceToken } from "./viceToken"

const DEV = {
  url: _("/dev"),
  psmServiceAccount: AWSSecret("MyViasat-TSUsage/PSM/serviceAccount"),
  anotherThing: AWSSecret("MyViasat-TSUsage/PSM/serviceAccount/DEV"),

  launchDarklyKey: AWSSecret("LDKEY FROM AWS"),
  featureA: Inputs("launchDarklyKey").chain(
    LaunchDarkly("feature-a", "default-value"),
  ),
}

const PROD = {
  ...DEV,
  url: _("/prod"),
  anotherThing: AWSSecret("MyViasat-TSUsage/PSM/serviceAccount/PROD"),

  viceUrl: _("vice"),
  viceCreds: _({ username: "test", password: "pass" }),
  viceToken: Inputs("viceUrl", "viceCreds").chain(ViceToken),
}

console.log(PROD)
const secretsManager = new SecretsManager({ region: "ap-south-1" })
new AWSManager(secretsManager)

// const result = await getEnvironment(PROD, {
//   secretsManager: new SecretsManager({ region: "ap-south-1" }),
// })

// result.psmServiceAccount
// result.anotherThing
// result.url

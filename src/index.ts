import { Secret } from "./secret"
import { Primative as _ } from "./primative"
import { LaunchDarkly } from "./launchDarkly"
import { Inputs } from "./inputs"
import { ViceToken } from "./viceToken"

const DEV = {
  url: _("/dev"),
  psmServiceAccount: Secret("MyViasat-TSUsage/PSM/serviceAccount"),
  anotherThing: Secret("MyViasat-TSUsage/PSM/serviceAccount/DEV"),
  featureA: LaunchDarkly("feature-a", "default-value"),
}

const PROD = {
  ...DEV,
  url: _("/prod"),
  anotherThing: Secret("MyViasat-TSUsage/PSM/serviceAccount/PROD"),

  viceToken: Inputs(["viceUrl", "viceCreds"]).chain(ViceToken),
}

console.log(PROD)
// const result = await getEnvironment(PROD, {
//   secretsManager: new SecretsManager({ region: "ap-south-1" }),
// })

// result.psmServiceAccount
// result.anotherThing
// result.url

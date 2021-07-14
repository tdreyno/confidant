import { AWSSecret } from "./third-party/awsSecret"
import { Hardcoded as _ } from "./core/hardcoded"
import { LaunchDarkly } from "./third-party/launchDarkly"
import { Inputs } from "./core/inputs"
import { ViceToken } from "./third-party/viceToken"

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
// const result = await getEnvironment(PROD, {
//   secretsManager: new SecretsManager({ region: "ap-south-1" }),
// })

// result.psmServiceAccount
// result.anotherThing
// result.url

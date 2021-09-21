import { Confidant, Hardcoded } from "@tdreyno/confidant"
import { AWSSecret, AWSManager } from "@tdreyno/confidant/dist/esm/third-party/awsSecret"
import { SecretsManager } from "aws-sdk"

const PROD = {
  five: Hardcoded("5"),
  aws: AWSSecret("1234")
}

const result = await Confidant({
  awsManager: new AWSManager(new SecretsManager({
    region: "us-west"
  }))
}, PROD).initialize()

result.five
result.aws
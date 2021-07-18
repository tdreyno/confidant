import { decode } from "jsonwebtoken"
import { Confidant, TaskMaker } from "../core/task"
import { requestJWT } from "../core/tokenManager"
import { Token } from "../core/token"

type ViceTokenData = { exp: number }
export class ViceToken_ extends Token<ViceTokenData> {
  constructor(
    confidant: Confidant<ViceTokenData, Record<string, any>>,
    private url: string,
    private credentials: { username: string; password: string },
  ) {
    super(confidant)
  }

  fetchToken(): Promise<string> {
    const { username, password } = this.credentials
    return requestJWT(this.url, username, password, this.manager)
  }

  decodeToken(token: string): ViceTokenData {
    // TODO: Actually validate the data is correct
    return decode(token) as unknown as ViceTokenData
  }
}

export const ViceToken =
  (
    url: string,
    credentials: { username: string; password: string },
  ): TaskMaker<ViceTokenData, ViceTokenData> =>
  context =>
    new ViceToken_(context, url, credentials)

export type ViceToken = ViceToken_

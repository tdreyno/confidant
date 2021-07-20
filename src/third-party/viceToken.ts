import { Confidant, TaskMaker } from "../core/task"
import { requestJWT } from "../core/jwtManager"
import { JWT } from "../core/jwt"

type ViceTokenData = { exp: number }
export class ViceToken_ extends JWT<ViceTokenData> {
  constructor(
    confidant: Confidant<ViceTokenData, Record<string, any>>,
    private url: string,
    private credentials: { username: string; password: string },
  ) {
    super(confidant)
  }

  fetchJWT(): Promise<string> {
    const { username, password } = this.credentials
    return requestJWT(this.url, username, password, this.manager)
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

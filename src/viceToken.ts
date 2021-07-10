import { decode } from "jsonwebtoken"
import { Manager, TaskMaker } from "./task"
import { requestJWT, Token } from "./token"

type ViceTokenData = { exp: number }
export class ViceToken_ extends Token<ViceTokenData> {
  constructor(
    manager: Manager<ViceTokenData, any, Record<string, any>>,
    private urlKey: string,
    private credentialKey: string,
  ) {
    super(manager, 5 * 60 /* 5 Minutes */)
  }

  fetchToken(): Promise<string> {
    return Promise.all([
      this.manager.get<string>(this.urlKey),
      this.manager.get<{ username: string; password: string }>(
        this.credentialKey,
      ),
    ]).then(([url, { username, password }]) =>
      requestJWT(url, username, password),
    )
  }

  decodeToken(token: string): ViceTokenData {
    // TODO: Actually validate the data is correct
    return decode(token) as unknown as ViceTokenData
  }
}

export const ViceToken =
  (
    urlKey: string,
    credentialKey: string,
  ): TaskMaker<ViceTokenData, ViceTokenData> =>
  context =>
    new ViceToken_(context, urlKey, credentialKey)

export type ViceToken = ViceToken_

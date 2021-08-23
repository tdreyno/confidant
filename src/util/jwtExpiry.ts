import { decode } from "jsonwebtoken"

export const nextRefreshTime = (
  data: string,
  refetchBufferTimeMs = 0,
): number => {
  const jwtData = decode(data) as unknown as { exp?: number }

  if (!jwtData.exp) {
    return Infinity
  }

  const expiryMs = jwtData.exp * 1000
  const now = Date.now()
  const timeTilExpireMs = expiryMs - now
  return timeTilExpireMs - refetchBufferTimeMs
}

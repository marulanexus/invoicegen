import { apiError, apiResult, readJson, withApiAuth } from "@/server/api/http";
import { registerDeviceForOrg, unregisterDeviceForOrg } from "@/server/notifications/devices";

/** Register this phone for push notifications: `{ token, platform: "ios" | "android" }`. */
export const POST = withApiAuth(async (ctx, req) => {
  const body = await readJson(req);
  if (body === undefined) return apiError(400, "bad_request", "Expected a JSON body.");
  return apiResult(await registerDeviceForOrg(ctx, body), 201);
});

/** Stop pushes to this phone (on sign-out): `{ token }`. */
export const DELETE = withApiAuth(async (ctx, req) => {
  const body = await readJson(req);
  if (body === undefined) return apiError(400, "bad_request", "Expected a JSON body.");
  return apiResult(await unregisterDeviceForOrg(ctx, body));
});

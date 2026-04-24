import type {
  MatrixLoginOptions,
  MatrixLoginSession,
  MatrixTokenLoginOptions,
} from "better-matrix-js";

export async function loginMatrix(options: MatrixLoginOptions): Promise<MatrixLoginSession> {
  const response = await fetch(new URL("/_matrix/client/v3/login", options.homeserverUrl), {
    body: JSON.stringify({
      identifier: {
        type: "m.id.user",
        user: options.username,
      },
      ...(options.deviceId ? { device_id: options.deviceId } : {}),
      initial_device_display_name: options.initialDeviceDisplayName ?? "Chat SDK",
      password: options.password,
      type: "m.login.password",
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Matrix login failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as {
    access_token: string;
    device_id: string;
    user_id: string;
  };

  return {
    accessToken: body.access_token,
    deviceId: body.device_id,
    homeserverUrl: options.homeserverUrl,
    userId: body.user_id,
  };
}

export async function loginMatrixWithToken(
  options: MatrixTokenLoginOptions
): Promise<MatrixLoginSession> {
  const response = await fetch(new URL("/_matrix/client/v3/login", options.homeserverUrl), {
    body: JSON.stringify({
      ...(options.deviceId ? { device_id: options.deviceId } : {}),
      initial_device_display_name: options.initialDeviceDisplayName ?? "Chat SDK",
      token: options.loginToken,
      type: options.type ?? "m.login.token",
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Matrix token login failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as {
    access_token: string;
    device_id: string;
    user_id: string;
  };

  return {
    accessToken: body.access_token,
    deviceId: body.device_id,
    homeserverUrl: options.homeserverUrl,
    userId: body.user_id,
  };
}

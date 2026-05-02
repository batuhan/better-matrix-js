export interface MatrixLoginOptions {
  deviceId?: string;
  homeserverUrl: string;
  initialDeviceDisplayName?: string;
  password: string;
  username: string;
}

export interface MatrixTokenLoginOptions {
  deviceId?: string;
  homeserverUrl: string;
  initialDeviceDisplayName?: string;
  loginToken: string;
  type?: "m.login.token" | "org.matrix.login.jwt";
}

export interface MatrixLoginSession {
  accessToken: string;
  deviceId: string;
  homeserverUrl: string;
  userId: string;
}

export async function loginMatrix(options: MatrixLoginOptions): Promise<MatrixLoginSession> {
  return matrixLoginRequest(options.homeserverUrl, "Matrix login failed", {
    identifier: {
      type: "m.id.user",
      user: options.username,
    },
    ...(options.deviceId ? { device_id: options.deviceId } : {}),
    initial_device_display_name: options.initialDeviceDisplayName ?? "Chat SDK",
    password: options.password,
    type: "m.login.password",
  });
}

export async function loginMatrixWithToken(
  options: MatrixTokenLoginOptions
): Promise<MatrixLoginSession> {
  return matrixLoginRequest(options.homeserverUrl, "Matrix token login failed", {
    ...(options.deviceId ? { device_id: options.deviceId } : {}),
    initial_device_display_name: options.initialDeviceDisplayName ?? "Chat SDK",
    token: options.loginToken,
    type: options.type ?? "m.login.token",
  });
}

async function matrixLoginRequest(
  homeserverUrl: string,
  errorPrefix: string,
  body: Record<string, unknown>
): Promise<MatrixLoginSession> {
  const response = await fetch(new URL("/_matrix/client/v3/login", homeserverUrl), {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`${errorPrefix}: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    device_id: string;
    user_id: string;
  };

  return {
    accessToken: data.access_token,
    deviceId: data.device_id,
    homeserverUrl,
    userId: data.user_id,
  };
}

# Bridge Login Flows

Small login process patterns for `@beeper/pickle-bridge` connectors.

## QR display and wait

```ts
import type { BridgeRequestContext, LoginProcessDisplayAndWait, LoginStep } from "@beeper/pickle-bridge/types";

export class QRLoginProcess implements LoginProcessDisplayAndWait {
  #complete = false;

  cancel() {
    this.#complete = true;
  }

  async start(): Promise<LoginStep> {
    return {
      displayAndWait: {
        data: "otpauth://example",
        imageUrl: "mxc://example/qr",
        type: "qr",
      },
      instructions: "Scan the QR code.",
      stepId: "qr",
      type: "display_and_wait",
    };
  }

  async wait(_ctx?: BridgeRequestContext): Promise<LoginStep> {
    this.#complete = true;
    return {
      complete: { userLoginId: "qr-login" },
      instructions: "QR login complete.",
      stepId: "complete",
      type: "complete",
    };
  }
}
```

## Cookie login

```ts
import type { LoginCookieInput, LoginProcessCookies, LoginStep } from "@beeper/pickle-bridge/types";

export class CookieLoginProcess implements LoginProcessCookies {
  cancel() {}

  async start(): Promise<LoginStep> {
    return {
      cookies: {
        fields: [{
          id: "session",
          required: true,
          sources: [{ name: "session", type: "cookie" }],
        }],
        url: "https://example.invalid/login",
      },
      instructions: "Log in and share the session cookie.",
      stepId: "cookies",
      type: "cookies",
    };
  }

  async submitCookies(cookies: LoginCookieInput): Promise<LoginStep> {
    if (!cookies.session) throw new Error("Missing session cookie");
    return {
      complete: { userLoginId: "cookie-login" },
      instructions: "Cookie login complete.",
      stepId: "complete",
      type: "complete",
    };
  }
}
```

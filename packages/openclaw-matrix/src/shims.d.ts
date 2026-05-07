declare module "markdown-it";
declare module "@mariozechner/pi-agent-core" {
  export type AgentToolResult<T = unknown> = {
    content?: T;
    error?: string;
    isError?: boolean;
    [key: string]: unknown;
  };
}

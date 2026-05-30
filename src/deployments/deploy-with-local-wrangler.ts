import { spawn } from "node:child_process";

import { resolveLocalWranglerBinary } from "../wrangler-bin.js";
import { redactSecrets } from "./redact-secrets.js";

export interface DeployWithLocalWranglerInput {
  assetDir: string;
  projectName: string;
  branch: string;
  accountId: string;
  apiToken: string;
}

export interface DeployWithLocalWranglerResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function deployWithLocalWrangler(
  input: DeployWithLocalWranglerInput,
): Promise<DeployWithLocalWranglerResult> {
  const wrangler = resolveLocalWranglerBinary();

  return new Promise((resolve, reject) => {
    const child = spawn(
      wrangler,
      [
        "pages",
        "deploy",
        input.assetDir,
        "--project-name",
        input.projectName,
        "--branch",
        input.branch,
        "--commit-dirty=true",
      ],
      {
        env: {
          ...process.env,
          CLOUDFLARE_ACCOUNT_ID: input.accountId,
          CLOUDFLARE_API_TOKEN: input.apiToken,
          CI: "true",
          NO_COLOR: "1",
        },
        cwd: input.assetDir,
        shell: process.platform === "win32",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

export function extractPreviewUrl(stdout: string): string | undefined {
  return stdout.match(/https:\/\/[^\s]+\.pages\.dev/)?.[0];
}

export function formatWranglerFailure(stdout: string, stderr: string): string {
  return redactSecrets(stderr || stdout).trim() || "wrangler deploy failed";
}

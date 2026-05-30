#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { resolveLocalWranglerBinary } from "./wrangler-bin.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function redactSecrets(value: string): string {
  return value.replace(/CLOUDFLARE_API_TOKEN=\S+/g, "CLOUDFLARE_API_TOKEN=[redacted]");
}

async function deploy(): Promise<void> {
  const apiToken = requireEnv("CLOUDFLARE_API_TOKEN");
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const projectName = requireEnv("PAGES_PROJECT_NAME");
  const branch = process.env.PAGES_BRANCH ?? "main";

  const source = path.resolve("index.html");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "page-deploy-"));
  const wrangler = resolveLocalWranglerBinary();

  try {
    await fs.copyFile(source, path.join(dir, "index.html"));

    const { exitCode, stdout, stderr } = await new Promise<{
      exitCode: number;
      stdout: string;
      stderr: string;
    }>((resolve, reject) => {
      const child = spawn(
        wrangler,
        ["pages", "deploy", dir, "--project-name", projectName, "--branch", branch, "--commit-dirty=true"],
        {
          env: {
            ...process.env,
            CLOUDFLARE_ACCOUNT_ID: accountId,
            CLOUDFLARE_API_TOKEN: apiToken,
            CI: "true",
            NO_COLOR: "1",
          },
          cwd: dir,
          shell: process.platform === "win32",
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );

      let out = "";
      let err = "";
      child.stdout.on("data", (chunk) => {
        out += chunk;
      });
      child.stderr.on("data", (chunk) => {
        err += chunk;
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ exitCode: code ?? 1, stdout: out, stderr: err }));
    });

    if (exitCode !== 0) {
      throw new Error(redactSecrets(stderr || stdout).trim() || "wrangler deploy failed");
    }

    const url = stdout.match(/https:\/\/[^\s]+\.pages\.dev/)?.[0];
    if (url) {
      process.stdout.write(`${url}\n`);
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

deploy().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});

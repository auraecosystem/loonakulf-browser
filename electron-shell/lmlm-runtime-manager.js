"use strict";

const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const path = require("path");

const STARTUP_TIMEOUT_MS = 12000;

function listenForFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyRuntime(url, token, child) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("LMLM runtime process exited during startup.");
    }
    try {
      const response = await fetch(url + "/v1/agents/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ prompt: "runtime startup verification" }),
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) return;
      if (response.status !== 401 && response.status !== 503) {
        throw new Error("LMLM runtime returned HTTP " + response.status + " during startup.");
      }
    } catch (error) {
      if (error.name !== "TypeError" && error.name !== "TimeoutError" && error.name !== "AbortError") {
        throw error;
      }
    }
    await delay(200);
  }
  throw new Error("LMLM runtime did not become ready before the startup deadline.");
}

async function startLmlmRuntime(electronApp) {
  // An explicitly supplied URL denotes an externally managed runtime. Its
  // operator remains responsible for provisioning the matching bearer token.
  if (process.env.LMLM_RUNTIME_URL) {
    return {
      url: process.env.LMLM_RUNTIME_URL.replace(/\/$/, ""),
      token: process.env.LMLM_IPC_TOKEN || "",
      child: null,
      managed: false,
    };
  }

  const runtimeDir = process.env.LMLM_RUNTIME_DIR ||
    (electronApp.isPackaged
      ? path.join(process.resourcesPath, "lmlm-runtime")
      : path.join(electronApp.getAppPath(), "lmlm-runtime"));
  if (!fs.existsSync(path.join(runtimeDir, "app.py"))) {
    throw new Error("LMLM runtime files were not found at " + runtimeDir);
  }

  const port = await listenForFreePort();
  const url = "http://127.0.0.1:" + port;
  const token = crypto.randomBytes(32).toString("base64url");
  const python = process.env.LMLM_PYTHON || (process.platform === "win32" ? "python" : "python3");
  const child = spawn(python, [
    "-m", "uvicorn", "app:app",
    "--host", "127.0.0.1",
    "--port", String(port),
    "--no-access-log",
  ], {
    cwd: runtimeDir,
    env: { ...process.env, LMLM_IPC_TOKEN: token },
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true,
  });

  let startupError = "";
  child.stderr.on("data", (chunk) => {
    // Keep only a short diagnostic tail; never log request headers or tokens.
    startupError = (startupError + chunk.toString()).slice(-2000);
  });
  child.on("error", (error) => {
    startupError = error.message;
  });

  try {
    await verifyRuntime(url, token, child);
  } catch (error) {
    child.kill();
    const detail = startupError.trim().split("\n").slice(-3).join(" ");
    throw new Error(detail
      ? error.message + " " + detail
      : error.message);
  }

  child.once("exit", (code, signal) => {
    if (code !== null || signal) {
      // The UI will report the runtime as unavailable on its next health check.
    }
  });

  return { url, token, child, managed: true };
}

function stopLmlmRuntime(runtime) {
  if (runtime && runtime.managed && runtime.child &&
      runtime.child.exitCode === null && runtime.child.signalCode === null) {
    runtime.child.kill();
  }
}

module.exports = { startLmlmRuntime, stopLmlmRuntime };

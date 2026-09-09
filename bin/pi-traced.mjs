#!/usr/bin/env node
import { applyProbelabEnvAliases } from "../.pi/lib/runtime-paths.mjs";
applyProbelabEnvAliases(process.env);
process.env.PROBELAB_TRACE = "1";
await import("./pi.mjs");

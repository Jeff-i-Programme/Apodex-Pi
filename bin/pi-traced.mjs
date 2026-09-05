#!/usr/bin/env node
process.env.APODEX_PI_TRACE = "1";
await import("./pi.mjs");

#!/usr/bin/env bun
import { ingest, SNAPSHOT_NAMES } from "./ingest-lib.ts";

const name = process.argv[2];
if (!name || name === "all") {
  if (!name) console.log(`usage: bun scripts/ingest.ts <${SNAPSHOT_NAMES.join("|")}|all>`);
  if (!name) process.exit(1);
  for (const n of SNAPSHOT_NAMES) console.log(await ingest(n));
} else {
  console.log(await ingest(name));
}

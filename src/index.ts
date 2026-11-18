import { app } from "./app.ts";
import { config } from "./core/config.ts";
import { allProviders, loadProviders } from "./providers/index.ts";
import { getDb } from "./core/store.ts";

loadProviders();
getDb();

const server = Bun.serve({
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
  idleTimeout: 30,
});

console.log(`MetaFlux ${config.version} listening on http://${config.host}:${config.port}`);
console.log(`${allProviders().length} keyless providers loaded; ${allProviders().filter((p) => p.auth === "optional-key").length} optional-key providers`);
console.log(`docs: http://${config.host}:${config.port}/docs`);

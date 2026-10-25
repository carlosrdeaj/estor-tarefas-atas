import assert from "node:assert/strict";
import test from "node:test";
import { resolveListen } from "./listen";

test("escuta em 0.0.0.0 e na porta PORT, com padrão 5000", () => {
  assert.deepEqual(resolveListen({}), { host: "0.0.0.0", port: 5000 });
  assert.deepEqual(resolveListen({ PORT: "8080", HOST: "127.0.0.1" }), { host: "127.0.0.1", port: 8080 });
  assert.throws(() => resolveListen({ PORT: "0" }), /PORT inválida/);
  assert.throws(() => resolveListen({ PORT: "abc" }), /PORT inválida/);
});

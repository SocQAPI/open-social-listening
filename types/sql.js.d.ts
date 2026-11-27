// Minimal types for sql.js (it ships none); only what the static demo and its test use.
declare module "sql.js" {
  import type { SqlJsStatic } from "@/lib/demo/static-bootstrap";
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
}

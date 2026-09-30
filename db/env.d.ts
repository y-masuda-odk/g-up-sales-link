declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    BOOTSTRAP_TOKEN?: string;
  }
}

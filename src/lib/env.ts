export function getEnv(key: string): string {
  return (process.env[key] || "").trim();
}

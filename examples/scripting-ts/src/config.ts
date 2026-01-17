export function loadConfig() {
  const requiredEnvVars: string[] = [
    // Add your required environment variables here
    // For example: 'RPC_URL', 'PRIVATE_KEY', etc.
  ];

  const missing = requiredEnvVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  return {
    // Map and validate your environment variables here
    // For example:
    // rpcUrl: process.env.RPC_URL!,
    // privateKey: process.env.PRIVATE_KEY!,
  };
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { installFileConsoleLogger } = await import(
      "@/lib/logging/file-console"
    );
    installFileConsoleLogger();
  }
}

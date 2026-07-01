export async function startKmApp() {
  const { startKmApp: startKmBootstrap } = await import("./bootstrap.ts");
  await startKmBootstrap();
}

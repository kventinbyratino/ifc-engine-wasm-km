export async function startKmApp() {
  const { startBimApp } = await import("../../bim/app/bootstrap.ts");
  await startBimApp();
}

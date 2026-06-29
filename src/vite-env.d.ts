declare module "*?url" {
  const url: string;
  export default url;
}

declare const __KM_BUILD_COMMIT__: string;

interface ImportMetaEnv {
  readonly VITE_KM_BUILD_COMMIT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

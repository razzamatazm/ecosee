// Vite inlines `?inline` asset imports as data: URI strings at build time.
declare module '*.woff2?inline' {
  const dataUri: string;
  export default dataUri;
}

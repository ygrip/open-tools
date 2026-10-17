// Shared by the Vite plugin and the standalone type-check/compiler command.
export default {
  outdir: './src/lib/paraglide',
  emitTsDeclarations: true,
  strategy: ['url', 'baseLocale'],
  trailingSlash: 'always'
};

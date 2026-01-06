module.exports = {
  // if the app is supposed to run on Github Pages in a subfolder, use the following config:
  // publicPath: process.env.NODE_ENV === "production" ? "/mytownsquare/" : "/" //github config
  // publicPath: process.env.NODE_ENV === "production" ? "/" : "/", // other config
  pages: {
    index: {
      entry: 'src/main.js',
      template: 'public/index.html',
      filename: 'index.html',
      chunks: ['chunk-vendors', 'chunk-common', 'index']
    },
    manual: {
      entry: 'src/manual/manual.js',
      template: 'public/manual.html',
      filename: 'manual.html',
      chunks: ['chunk-vendors', 'chunk-common', 'manual']
    },
    donation: {
      entry: 'src/donation/donation.js',
      template: 'public/donation.html',
      filename: 'donation.html',
      chunks: ['chunk-vendors', 'chunk-common', 'donation']
    }
  },
  productionSourceMap: false
};

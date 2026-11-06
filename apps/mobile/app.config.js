const { execFileSync } = require('node:child_process');
const app = require('./app.json');
module.exports = () => {
  const release = process.env.SENTRY_RELEASE || process.env.GITHUB_SHA ||
    execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  return { ...app.expo, extra: { ...app.expo.extra, monitoringRelease: release } };
};

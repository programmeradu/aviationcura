const { execSync } = require('child_process');

const secrets = {
  RAPIDAPI_KEY: "00059d85f2msh95f9ef65a2f1ef9p1b96c9jsnc0493b152457",
  YOUTUBE_API_KEY: "AIzaSyAf9PWGPkllsHhhNQf6729VfFzk1SjlrAE",
  TELEGRAM_BOT_TOKEN: "8839496955:AAGEC5j_BOsi2IM3wXeuI-xILUVo9Jbrkzk",
  TELEGRAM_CHAT_ID: "1340677589"
};

console.log("Setting secrets...");
for (const [key, value] of Object.entries(secrets)) {
  console.log(`Setting ${key}...`);
  execSync(`npx wrangler secret put ${key}`, { input: value, stdio: ['pipe', 'inherit', 'inherit'] });
}

console.log("Deploying worker...");
execSync(`npm run deploy`, { stdio: 'inherit' });
console.log("Deployment complete!");

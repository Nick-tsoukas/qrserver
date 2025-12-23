"use strict";

async function main() {
  const scriptName = process.argv[2];
  if (!scriptName) {
    console.error("Usage: node ./src/scripts/run.js <scriptFile>");
    process.exit(1);
  }

  const script = require(`./${scriptName}`);
  await script({ strapi });
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

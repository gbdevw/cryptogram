import { loadConfig } from './config';

async function main() {
  const config = loadConfig();

  // Use the SDK here
  console.log('Script started...');
  console.log('Config loaded:', config);

  // Your script logic goes here
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

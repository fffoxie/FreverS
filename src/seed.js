import config from './config.js';
import { openDatabase, seedAccounts } from './db.js';

const db = openDatabase();
const result = seedAccounts(db);
if (result.created.length === 0) {
  console.log(`[seed] database already has accounts: ${config.dbPath}`);
} else {
  console.log(`[seed] created accounts: ${result.created.join(', ')}`);
}
if (result.credentialsPath) {
  console.log(`[seed] generated passwords: ${result.credentialsPath}`);
}

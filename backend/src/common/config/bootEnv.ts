// Side-effect module: must be the FIRST import of the entry point so that
// .env is loaded and validated before any other module reads process.env.
import 'dotenv/config';
import { validateEnvOrExit } from './env';

validateEnvOrExit();

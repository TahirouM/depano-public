import { bootstrapWorker } from '@depano/api';

bootstrapWorker().catch((e) => {
  console.error(e);
  process.exit(1);
});

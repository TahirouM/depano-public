// Environnement de test : base dédiée, Redis db 15, prestataires factices, aucun appel réseau sortant.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://depano:depano@localhost:5432/depano_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15';
process.env.PAYMENT_PROVIDER = 'fake';
process.env.SMS_PROVIDER = 'console';
process.env.PUSH_PROVIDER = 'console';
process.env.TWILIO_PROXY_SERVICE_SID = '';
process.env.OFFLINE_MODE = 'true';
process.env.LOG_LEVEL = 'error';

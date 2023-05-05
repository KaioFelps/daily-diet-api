import knexSetup, { Knex } from "knex";
import { env } from "./env";

export const knexConfig: Knex.Config = {
  client: env.DATABASE_CLIENT,
  connection:
    env.DATABASE_CLIENT === "sqlite"
      ? {
          filename: env.DATABASE_URL,
        }
      : env.DATABASE_URL,
  useNullAsDefault: true,
  migrations: {
    directory: "./db/migrations",
    extension: "ts",
  },
};

// é exportado porque usamos essas configurações na cli do knex além de usá-la no inicializador.
export const knex = knexSetup(knexConfig);

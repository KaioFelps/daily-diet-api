import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("meals", (table) => {
    table
      .dateTime("created_at", {
        useTz: true,
      })
      .defaultTo(knex.fn.now())
      .alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("meals", (table) => {
    table
      .dateTime("created_at", {
        useTz: true,
      })
      .defaultTo(knex.fn.now)
      .alter();
  });
}

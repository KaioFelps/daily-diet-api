import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("meals", (table) => {
    table.uuid("id").primary().index();
    table.string("title", 32).notNullable().index();
    table.text("desc");
    table
      .dateTime("created_at", {
        useTz: true,
      })
      .defaultTo(knex.fn.now);
    table.boolean("diet").notNullable();
  });

  await knex.schema.createTable("sessions", (table) => {
    table.uuid("id").primary();
    table
      .dateTime("created_at", {
        useTz: true,
      })
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("meal_session", (table) => {
    table.uuid("id").primary();
    table.uuid("session_id");
    table.uuid("meal_id");

    table.foreign("session_id").references("id").inTable("sessions");
    table.foreign("meal_id").references("id").inTable("meals");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("sessions");
  await knex.schema.dropTable("meals");
  await knex.schema.dropTable("meal_session");
}

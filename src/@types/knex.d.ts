// eslint-disable-next-line no-unused-vars
import { Knex } from "knex";

declare module "knex/types/tables" {
  export interface Tables {
    meals: {
      id: string;
      title: string;
      desc: string;
      created_at: string;
      diet: boolean;
    };
    sessions: {
      id: string;
      created_at: string;
    };
    meal_session: {
      id: string;
      session_id: string;
      meal_id: string;
    };
  }
}

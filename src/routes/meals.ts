import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import z from "zod";
import { knex } from "../db";
import validateSessionId from "../middlewares/validate-session-id";
import getSessionId from "../utils/get-session-id";

export async function mealsRoutes(app: FastifyInstance) {
  app.post("/new", async (req, res) => {
    const newTaskSchema = z.object({
      title: z.string().max(30),
      description: z.string().optional().nullable(),
      isDiet: z.boolean(),
    });

    const newTaskProps = newTaskSchema.safeParse(req.body);

    if (!newTaskProps.success) {
      console.error("Há campos obrigatórios não preenchidos");
      res.code(400);
      throw new Error("Há campos obrigatórios não preenchidos.");
    }

    const { description, isDiet, title } = newTaskProps.data;

    const sessionCookie = req.headers.cookie;
    let sessionId: string;

    if (!sessionCookie) {
      sessionId = randomUUID();

      res.setCookie("session_id", sessionId, {
        httpOnly: true,
        secure: true,
        maxAge:
          1000 * // 1 segundo
          60 * // 1 minuto
          60 * // 1 hora
          24 * // 1 dia
          31, // 1 mes
      });
    } else {
      sessionId = sessionCookie.split(/[;=]/g)[1];
    }

    const isRegistered =
      (await knex("sessions").select("id").where("id", "like", sessionId))
        .length > 0;

    if (!isRegistered) {
      await knex("sessions").insert({
        id: sessionId,
      });
    }

    const [{ id: mealId }] = await knex("meals")
      .insert({
        title,
        desc: description,
        diet: isDiet,
        id: randomUUID(),
      })
      .returning("id");

    await knex("meal_session").insert({
      id: randomUUID(),
      meal_id: mealId,
      session_id: sessionId,
    });

    res.code(204);
  });

  app.get(
    "/list",
    {
      preHandler: [validateSessionId],
    },
    async (req, res) => {
      const sessionId = getSessionId(req);

      const mealsIDs = await knex("meal_session")
        .select("meal_id")
        .where("session_id", "like", sessionId);

      const arrayOfMealIDs: string[] = [];

      for (let i = 0; i < mealsIDs.length; i++) {
        const mealId = mealsIDs[i].meal_id;
        arrayOfMealIDs.push(mealId);
      }

      const mealsList = await knex("meals")
        .select()
        .whereIn("id", arrayOfMealIDs);

      return res.code(200).send({ data: mealsList });
    }
  );

  // app.get("/reset", async () => {
  //   await knex("meals").del();
  //   await knex("meal_session").del();
  //   await knex("sessions").del();
  // });
}

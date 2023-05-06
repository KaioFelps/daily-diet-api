import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import z from "zod";
import { knex } from "../db";

export async function mealsRoutes(app: FastifyInstance) {
  app.post("/new", async (req, res) => {
    const newTaskSchema = z.object({
      title: z.string().max(30),
      description: z.string().nullable(),
      isDiet: z.boolean(),
    });

    const newTaskProps = newTaskSchema.safeParse(req.body);

    if (!newTaskProps.success) {
      console.error("Há campos obrigatórios não preenchidos");
      res.status(400);
      throw new Error("Há campos obrigatórios não preenchidos.");
    }

    const { description, isDiet, title } = newTaskProps.data;

    let sessionId = req.headers.session_id as string;

    if (!sessionId) {
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

    res.status(204);
  });

  app.get("/reset", async () => {
    await knex("meals").del();
    await knex("meal_session").del();
    await knex("sessions").del();
  });
}

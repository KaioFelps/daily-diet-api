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
      desc: z.string().optional().nullable(),
      diet: z.boolean(),
      created_at: z
        .string()
        .datetime()
        .optional()
        .default(new Date().toISOString()),
    });

    const newTaskProps = newTaskSchema.safeParse(req.body);

    if (!newTaskProps.success) {
      console.error("Há campos obrigatórios não preenchidos");
      res.code(400);
      throw new Error("Há campos obrigatórios não preenchidos.");
    }

    const { desc, diet, title, created_at: createdAt } = newTaskProps.data;

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

    const formattedCreatedAt = createdAt.replace("T", " ").replace(/\..*$/, "");

    const [{ id: mealId }] = await knex("meals")
      .insert({
        title,
        desc,
        diet,
        id: randomUUID(),
        created_at: formattedCreatedAt,
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
        .whereIn("id", arrayOfMealIDs)
        .orderBy("created_at", "desc");

      return res.code(200).send({ data: mealsList });
    }
  );

  app.get(
    "/:id",
    {
      preHandler: [validateSessionId],
    },
    async (req, res) => {
      const requestParamSchema = z.object({
        id: z.string().uuid(),
      });

      const requestParam = requestParamSchema.safeParse(req.params);

      if (!requestParam.success) {
        return res
          .code(400)
          .send({ message: "Nenhum ID de refeição foi fornecido." });
      }

      const { id: mealId } = requestParam.data;

      const sessionId = getSessionId(req);

      const [{ session_id: mealSessionId }] = await knex("meal_session")
        .select("session_id")
        .where("meal_id", "like", mealId);

      if (!mealSessionId) {
        return res.code(200).send({ data: {} });
      }

      if (sessionId !== mealSessionId) {
        return res.code(401).send({ message: "Unauthorized" });
      }

      const [meal] = await knex("meals").select().where("id", "like", mealId);

      return res.status(200).send({
        data: meal,
      });
    }
  );

  app.delete(
    "/delete/:id",
    { preHandler: [validateSessionId] },
    async (req, res) => {
      const requestParamsSchema = z.object({
        id: z.string().uuid(),
      });

      const requestParams = requestParamsSchema.safeParse(req.params);

      if (!requestParams.success) {
        return res.code(404).send({ message: "Nenhum ID foi fornecido." });
      }

      const { id: mealId } = requestParams.data;
      const sessionId = getSessionId(req);

      const isMealIdFromSessionId =
        (
          await knex("meal_session")
            .select()
            .where("session_id", "like", sessionId)
            .andWhere("meal_id", "like", mealId)
        ).length > 0;

      if (!isMealIdFromSessionId) {
        return res.code(401).send({ message: "Unauthorized" });
      }

      await knex("meals").delete().where("id", "like", mealId);
      res.code(204);
    }
  );

  app.patch(
    "/edit/:id",
    {
      preHandler: [validateSessionId],
    },
    async (req, res) => {
      const requestParamsSchema = z.object({
        id: z.string().uuid(),
      });
      const requestBodySchema = z.object({
        title: z.string().optional(),
        desc: z.string().max(30).optional().nullable(),
        diet: z.boolean().optional(),
      });

      const { title, desc, diet } = requestBodySchema.parse(req.body);

      if (!title && !desc && !diet) {
        return res.code(204);
      }

      const requestParams = requestParamsSchema.safeParse(req.params);
      if (!requestParams.success) {
        return res.code(400).send({ message: "Nenhum ID foi fornecido." });
      }

      const { id: mealId } = requestParams.data;
      const [{ session_id: mealSessionId }] = await knex("meal_session")
        .select("session_id")
        .where("meal_id", "like", mealId);
      const sessionId = getSessionId(req);

      if (!mealSessionId) {
        return res.code(404).send({ message: "Refeição não encontrada." });
      }

      if (mealSessionId !== sessionId) {
        return res.code(401).send({ message: "Unauthorized" });
      }

      await knex("meals")
        .where("id", "like", mealId)
        .modify((qb) => {
          if (title && typeof title === "string") {
            qb.update("title", title);
          }
          if (desc && typeof desc === "string") {
            qb.update("desc", desc);
          }
          if (typeof diet === "boolean") {
            qb.update("diet", diet);
          }
        })
        .catch((error) => {
          console.error(error);
          return res.code(500).send({ message: error });
        });

      res.code(204);
    }
  );

  app.get(
    "/metrics",
    {
      preHandler: validateSessionId,
    },
    async (req, res) => {
      const sessionId = getSessionId(req);

      const userMealsIDs = (
        await knex("meal_session")
          .select("meal_id")
          .where("session_id", sessionId)
      ).map((meal) => {
        return meal.meal_id;
      });

      const userHealthyMeals = await knex("meals")
        .count("diet", { as: "total" })
        .where("diet", true);

      const healthyMealsSequences: {
        id: string;
        title: string;
        desc: string | null;
        created_at: string;
        diet: boolean;
      }[][] = [];

      let healthyMealIterableArray: {
        id: string;
        title: string;
        desc: string | null;
        created_at: string;
        diet: boolean;
      }[] = [];

      const userMeals = await knex("meals")
        .select()
        .whereIn("id", userMealsIDs)
        .orderBy("created_at");

      // gets the sequences of healthy meals
      for (const meal of userMeals) {
        if (meal.diet) {
          healthyMealIterableArray.push(meal);
        } else if (healthyMealIterableArray.length > 0) {
          healthyMealsSequences.push(healthyMealIterableArray);
          healthyMealIterableArray = [];
        }
      }

      // gets the longest healthy meals sequence
      let biggestSequenceLength = 0;

      for (const sequence of healthyMealsSequences) {
        if (sequence.length > biggestSequenceLength) {
          biggestSequenceLength = sequence.length;
        }
      }

      res.status(200).send({
        totalMeals: userMealsIDs.length,
        totalDietMeals: Number(userHealthyMeals[0].total),
        totalNonDietMeals:
          userMealsIDs.length - Number(userHealthyMeals[0].total),
        dietSequenceRecord: biggestSequenceLength,
      });
    }
  );
}

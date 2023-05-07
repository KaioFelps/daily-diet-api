import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import request from "supertest";
import { execSync } from "node:child_process";

describe("meals routes", async () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    execSync("npm run knex -- migrate:rollback --all");
    execSync("npm run knex -- migrate:latest");
  });

  // ---

  it("should generate to an user a session id if request is valid", async () => {
    const response = await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        desc: "ate a hamburguer with friends",
        diet: false,
      })
      .expect(204);

    const cookies = response.header["set-cookie"];
    expect(cookies).not.toBeUndefined();
  });

  it("should not accept a request with missing fields", async () => {
    await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        diet: false,
      })
      .expect(204);

    await request(app.server)
      .post("/meals/new")
      .send({
        desc: "ate a hamburguer with friends",
        diet: false,
      })
      .expect(400);

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        desc: "ate a hamburguer with friends",
      })
      .expect(400);
  });

  it("should be possible to identify an user between requests", async () => {
    const response1 = await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        desc: "ate a hamburguer with friends",
        diet: false,
      })
      .expect(204);

    const firstRequestCookies = response1.get("Set-Cookie");
    // const sessionId = firstRequestCookies[0].split(/[;=]/g)[1];

    const response2 = await request(app.server)
      .post("/meals/new")
      .set("Cookie", firstRequestCookies)
      .send({
        title: "salad",
        desc: "made salad for dinner",
        diet: true,
      })
      .expect(204);

    const secondRequestCookies = response2.get("Set-Cookie");
    expect(secondRequestCookies).toBeUndefined();
  });

  it("should list all of an user meals", async () => {
    const firstRequest = await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        desc: "ate a hamburguer with friends",
        diet: false,
      })
      .expect(204);

    const cookies = firstRequest.get("Set-Cookie");
    const currentDate = new Date();
    const tenSecondsAheadDate = new Date().setSeconds(
      currentDate.getSeconds() + 10
    );

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "salad",
        desc: "made salad for dinner",
        diet: true,
        created_at: new Date(tenSecondsAheadDate).toISOString(),
      })
      .set("Cookie", cookies)
      .expect(204);

    const listAllMealsResponse = await request(app.server)
      .get("/meals/list")
      .set("Cookie", cookies)
      .expect(200);

    expect(listAllMealsResponse.body).toEqual({
      data: [
        expect.objectContaining({
          title: "salad",
          desc: "made salad for dinner",
          diet: 1,
        }),
        expect.objectContaining({
          title: "hamburguer",
          desc: "ate a hamburguer with friends",
          diet: 0,
        }),
      ],
    });
  });

  it("should be possible to get a specific meal data", async () => {
    const firstRequestResponse = await request(app.server)
      .post("/meals/new")
      .send({
        title: "salad",
        desc: "made salad for dinner",
        diet: true,
      })
      .expect(204);

    const firstRequestCookies = firstRequestResponse.get("Set-Cookie");

    const currentDate = new Date();
    const currentDateTenSecondsAhead = new Date().setSeconds(
      currentDate.getSeconds() + 10
    );
    await request(app.server)
      .post("/meals/new")
      .set("Cookie", firstRequestCookies)
      .send({
        title: "hamburguer",
        desc: "ate a hamburguer with friends",
        diet: false,
        created_at: new Date(currentDateTenSecondsAhead).toISOString(),
      })
      .expect(204);

    const secondRequestId = (
      await request(app.server)
        .get("/meals/list")
        .set("Cookie", firstRequestCookies)
    ).body.data[0].id;
    // it is the first object returned, because it is the latest meal added!

    const specificMealResponse = await request(app.server)
      .get(`/meals/${secondRequestId}`)
      .set("Cookie", firstRequestCookies)
      .expect(200);

    expect(specificMealResponse.body).toEqual({
      data: expect.objectContaining({
        title: "hamburguer",
        desc: "ate a hamburguer with friends",
        diet: 0,
      }),
    });
  });

  it.skip("shouldn't show other user's meal", async () => {
    const firstRequestResponse = await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        desc: "ate a hamburguer with friends",
        diet: false,
      })
      .expect(204);

    const firstRequestCookies = firstRequestResponse.get("Set-Cookie");

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        desc: "ate a hamburguer with friends",
        diet: false,
      })
      .expect(204);

    const listFirstUserMeals = await request(app.server)
      .get("/meals/list")
      .set("Cookie", firstRequestCookies)
      .expect(200);

    expect(listFirstUserMeals.body.data.length).toBe(1);
  });

  it.skip("should let a user delete his meal", async () => {
    const firstRequestResponse = await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        desc: "ate a hamburguer with friends",
        diet: false,
      })
      .expect(204);

    const firstRequestCookies = firstRequestResponse.get("Set-Cookie");

    const firstRequestId = (
      await request(app.server)
        .get("/meals/list")
        .set("Cookie", firstRequestCookies)
        .expect(200)
    ).body.data[0].id;

    await request(app.server)
      .delete(`/meals/delete/${firstRequestId}`)
      .set("Cookie", firstRequestCookies)
      .expect(204);
  });

  it.skip("should not let a user delete other's user meal", async () => {
    const firstRequestResponse = await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        desc: "ate a hamburguer with friends",
        diet: false,
      })
      .expect(204);

    const firstRequestCookies = firstRequestResponse.get("Set-Cookie");

    const firstRequestId = (
      await request(app.server)
        .get("/meals/list")
        .set("Cookie", firstRequestCookies)
        .expect(200)
    ).body.data[0].id;

    await request(app.server)
      .delete(`/meals/delete/${firstRequestId}`)
      .expect(400);
  });

  it.skip("should be possible to edit a meal", async () => {
    const firstRequest = await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        desc: "ate a hamburguer with friends",
        diet: false,
      })
      .expect(204);

    const firstRequestCookies = firstRequest.get("Set-Cookie");

    const firstRequestId = (
      await request(app.server)
        .get("/meals/list")
        .set("Cookie", firstRequestCookies)
        .expect(200)
    ).body.data[0].id;

    await request(app.server)
      .patch(`/meals/edit/${firstRequestId}`)
      .send({
        title: "salad",
      })
      .set("Cookie", firstRequestCookies)
      .expect(204);

    await request(app.server)
      .patch(`/meals/edit/${firstRequestId}`)
      .send({
        desc: "made salad for dinner",
      })
      .set("Cookie", firstRequestCookies)
      .expect(204);

    await request(app.server)
      .patch(`/meals/edit/${firstRequestId}`)
      .send({
        diet: true,
      })
      .set("Cookie", firstRequestCookies)
      .expect(204);

    const editedRequest = await request(app.server)
      .get(`/meals/${firstRequestId}`)
      .set("Cookie", firstRequestCookies)
      .expect(200);

    expect(editedRequest.body).toEqual({
      data: expect.objectContaining({
        title: "salad",
        desc: "made salad for dinner",
        diet: true,
      }),
    });

    // second request, all at once

    await request(app.server)
      .patch(`/meals/edit/${firstRequestId}`)
      .send({
        title: "ice cream",
        desc: "blue berry icecream",
        diet: false,
      })
      .set("Cookie", firstRequestCookies)
      .expect(204);

    const secondEditedRequest = await request(app.server)
      .get(`/meals/${firstRequestId}`)
      .set("Cookie", firstRequestCookies)
      .expect(200);

    expect(secondEditedRequest.body).toEqual({
      data: expect.objectContaining({
        title: "ice cream",
        desc: "blue berry icecream",
        diet: false,
      }),
    });
  });

  it.skip("shouldn't be possible to edit other user's meal", async () => {
    const firstRequest = await request(app.server)
      .post("/meals/new")
      .send({
        title: "ice cream",
        desc: "blue berry icecream",
        diet: false,
      })
      .expect(204);

    const firstRequestCookies = firstRequest.get("Set-Cookie");
    const firstRequestId = (
      await request(app.server)
        .get("/meals/list")
        .set("Cookie", firstRequestCookies)
        .expect(200)
    ).body.data[0].id;

    await request(app.server)
      .patch(`/meals/edit/${firstRequestId}`)
      .send({
        title: "salad",
      })
      .expect(400);
  });

  it.skip("should let a user get it's metrics", async () => {
    const firstRequest = await request(app.server)
      .post("/meals/new")
      .send({
        title: "ice cream",
        desc: "blue berry icecream",
        diet: false,
      })
      .expect(204);

    const firstRequestCookies = firstRequest.get("Set-Cookie");

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "salad",
        desc: "made salad for dinner",
        diet: true,
      })
      .set("Cookie", firstRequestCookies)
      .expect(204);

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "bread with scrambled eggs",
        desc: "for breakfast",
        diet: true,
      })
      .set("Cookie", firstRequestCookies)
      .expect(204);

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "Mok the Poke",
        desc: "fitness food for lunch",
        diet: true,
      })
      .set("Cookie", firstRequestCookies)
      .expect(204);

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "pizza",
        desc: "4 cheese 12 pieces pizza",
        diet: false,
      })
      .set("Cookie", firstRequestCookies)
      .expect(204);

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "salad with eggs",
        desc: "for breakfast",
        diet: true,
      })
      .set("Cookie", firstRequestCookies)
      .expect(204);

    // ---

    const metricsResponse = await request(app.server)
      .get("/meals/metrics")
      .set("Cookie", firstRequestCookies)
      .expect(200);

    expect(metricsResponse.body).toEqual({
      totalMeals: 6,
      totalDietMelas: 4,
      totalNonDietMeals: 2,
      dietSequenceRecord: 3,
    });
  });

  it.skip("shouldn't show a user other user's metric", async () => {
    await request(app.server).get("/meals/metrics").expect(400);
  });
});

/*
- [x] Deve ser possível criar um usuário
- [x] Deve ser possível identificar o usuário entre as requisições
- [x] Deve ser possível registrar uma refeição feita, com as seguintes informações:
    <!-- As refeições devem ser relacionadas a um usuário. -->
    - Nome
    - Descrição
    - Data e Hora
    - Está dentro ou não da dieta
- [x] Deve ser possível editar uma refeição, podendo alterar todos os dados acima
- [x] Deve ser possível apagar uma refeição
- [x] Deve ser possível listar todas as refeições de um usuário
- [x] Deve ser possível visualizar uma única refeição
- [x] Deve ser possível recuperar as métricas de um usuário
    - Quantidade total de refeições registradas
    - Quantidade total de refeições dentro da dieta
    - Quantidade total de refeições fora da dieta
    - Melhor sequência por dia de refeições dentro da dieta
- [x] O usuário só pode visualizar, editar e apagar as refeições criadas por ele
*/

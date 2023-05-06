import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import request from "supertest";
import { execSync } from "node:child_process";

describe("meals routes", async () => {
  beforeAll(() => {
    app.ready();
  });

  afterAll(() => {
    app.close();
  });

  beforeEach(() => {
    execSync("npm run knex -- migrate:rollback --all");
    execSync("npm run knex -- migrate:latest");
  });

  // ---

  it("should generate to an user a session id if request is valid", async () => {
    const response = await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        description: "ate a hamburguer with friends",
        isDiet: false,
      })
      .expect(204);
    const cookies = response.header["set-cookies"];
    expect(cookies).not.toBeUndefined();
  });

  it("should not accept a request with missing fields", async () => {
    await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        isDiet: false,
      })
      .expect(400);

    await request(app.server)
      .post("/meals/new")
      .send({
        description: "ate a hamburguer with friends",
        isDiet: false,
      })
      .expect(400);

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        description: "ate a hamburguer with friends",
      })
      .expect(400);
  });

  it("should be possible to identify an user between requests", async () => {
    const response1 = await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        description: "ate a hamburguer with friends",
        isDiet: false,
      })
      .expect(204);

    const cookies1 = response1.get("Set-Cookie");

    const response2 = await request(app.server)
      .post("/meals/new")
      .send({
        title: "salad",
        description: "made salad for dinner",
        isDiet: true,
      })
      .set("Cookie", cookies1)
      .expect(204);

    const cookies2 = response2.get("Set-Cookie");

    expect(cookies1).toEqual(cookies2);
  });

  it("should list all of an user meals", async () => {
    const firstRequest = await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        description: "ate a hamburguer with friends",
        isDiet: false,
      })
      .expect(204);

    const cookies = firstRequest.get("Set-Cookie");

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "salad",
        description: "made salad for dinner",
        isDiet: true,
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
          title: "hamburguer",
          description: "ate a hamburguer with friends",
          isDiet: false,
        }),
        expect.objectContaining({
          title: "salad",
          description: "made salad for dinner",
          isDiet: true,
        }),
      ],
    });
  });

  it("should be possible to get a specific meal data", async () => {
    const firstRequestResponse = await request(app.server)
      .post("/meals/new")
      .send({
        title: "salad",
        description: "made salad for dinner",
        isDiet: true,
      })
      .expect(204);

    const firstRequestCookies = firstRequestResponse.get("Set-Cookie");

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        description: "ate a hamburguer with friends",
        isDiet: false,
      })
      .set("Cookie", firstRequestCookies)
      .expect(204);

    const secondRequestId = (await request(app.server).get("/meals/list")).body
      .data[1].id;

    const specificMealResponse = await request(app.server)
      .get(`/meals/${secondRequestId}`)
      .set("Cookie", firstRequestCookies)
      .expect(200);

    expect(specificMealResponse.body).toEqual({
      data: expect.objectContaining({
        title: "hamburguer",
        description: "ate a hamburguer with friends",
        isDiet: false,
      }),
    });
  });

  it("shouldn't show other user's meal", async () => {
    const firstRequestResponse = await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        description: "ate a hamburguer with friends",
        isDiet: false,
      })
      .expect(204);

    const firstRequestCookies = firstRequestResponse.get("Set-Cookie");

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        description: "ate a hamburguer with friends",
        isDiet: false,
      })
      .expect(204);

    const listFirstUserMeals = await request(app.server)
      .get("/meals/list")
      .set("Cookie", firstRequestCookies)
      .expect(200);

    expect(listFirstUserMeals.body.data.length).toBe(1);
  });

  it("should let a user delete his meal", async () => {
    const firstRequestResponse = await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        description: "ate a hamburguer with friends",
        isDiet: false,
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

  it("should not let a user delete other's user meal", async () => {
    const firstRequestResponse = await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        description: "ate a hamburguer with friends",
        isDiet: false,
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

  it("should be possible to edit a meal", async () => {
    const firstRequest = await request(app.server)
      .post("/meals/new")
      .send({
        title: "hamburguer",
        description: "ate a hamburguer with friends",
        isDiet: false,
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
        description: "made salad for dinner",
      })
      .set("Cookie", firstRequestCookies)
      .expect(204);

    await request(app.server)
      .patch(`/meals/edit/${firstRequestId}`)
      .send({
        isDiet: true,
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
        description: "made salad for dinner",
        isDiet: true,
      }),
    });

    // second request, all at once

    await request(app.server)
      .patch(`/meals/edit/${firstRequestId}`)
      .send({
        title: "ice cream",
        description: "blue berry icecream",
        isDiet: false,
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
        description: "blue berry icecream",
        isDiet: false,
      }),
    });
  });

  it("shouldn't be possible to edit other user's meal", async () => {
    const firstRequest = await request(app.server)
      .post("/meals/new")
      .send({
        title: "ice cream",
        description: "blue berry icecream",
        isDiet: false,
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

  it("should let a user get it's metrics", async () => {
    const firstRequest = await request(app.server)
      .post("/meals/new")
      .send({
        title: "ice cream",
        description: "blue berry icecream",
        isDiet: false,
      })
      .expect(204);

    const firstRequestCookies = firstRequest.get("Set-Cookie");

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "salad",
        description: "made salad for dinner",
        isDiet: true,
      })
      .set("Cookie", firstRequestCookies)
      .expect(204);

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "bread with scrambled eggs",
        description: "for breakfast",
        isDiet: true,
      })
      .set("Cookie", firstRequestCookies)
      .expect(204);

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "Mok the Poke",
        description: "fitness food for lunch",
        isDiet: true,
      })
      .set("Cookie", firstRequestCookies)
      .expect(204);

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "pizza",
        description: "4 cheese 12 pieces pizza",
        isDiet: false,
      })
      .set("Cookie", firstRequestCookies)
      .expect(204);

    await request(app.server)
      .post("/meals/new")
      .send({
        title: "salad with eggs",
        description: "for breakfast",
        isDiet: true,
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

  it("shouldn't show a user other user's metric", async () => {
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

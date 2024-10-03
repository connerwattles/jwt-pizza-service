const request = require("supertest");
const app = require("../src/service.js");

describe("GET /", () => {
  it("responds with a welcome message and the version", async () => {
    const response = await request(app).get("/");
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("message");
    expect(response.body.message).toBe("welcome to JWT Pizza");
    expect(response.body).toHaveProperty("version");
    expect(response.body.version).toBe("20240518.154317");
  });
});

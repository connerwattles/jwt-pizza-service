const request = require("supertest");
const app = require("../src/service");

// Mocking the required routers and middleware
jest.mock("../src/routes/authRouter.js", () => ({
  authRouter: require("express").Router(),
  setAuthUser: jest.fn((req, res, next) => next()),
}));
jest.mock("../src/routes/orderRouter.js", () => require("express").Router());
jest.mock("../src/routes/franchiseRouter.js", () =>
  require("express").Router()
);
jest.mock("../src/version.json", () => ({ version: "1.0.0" }));
jest.mock("../src/config.js", () => ({
  factory: { url: "https://pizza.smittywerb.click/" },
  db: { connection: { host: "127.0.0.1" } },
}));
jest.mock("../src/routes/authRouter.js", () => {
  const router = require("express").Router();
  router.get("/error", (req, res, next) => {
    next(new Error("Test error"));
  });
  return {
    authRouter: router,
    setAuthUser: jest.fn((req, res, next) => next()),
  };
});

describe("Test API routes", () => {
  test("GET / should return welcome message", async () => {
    const response = await request(app).get("/");
    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("welcome to JWT Pizza");
    expect(response.body.version).toBe("1.0.0");
  });

  test("GET /unknown should return 404", async () => {
    const response = await request(app).get("/unknown");
    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("unknown endpoint");
  });

  test("GET /api/auth/error should return 500", async () => {
    const response = await request(app).get("/api/auth/error");
    expect(response.statusCode).toBe(500);
  });
});

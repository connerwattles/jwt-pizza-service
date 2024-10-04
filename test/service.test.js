const request = require("supertest");
const app = require("../src/service.js");

// Mock the database module
jest.mock("../src/database/database.js", () => {
  return {
    getOrder: jest.fn(), // Assuming you have a getOrder function in your database module
    addMenuItem: jest.fn(),
    addUser: jest.fn(),
  };
});

const dbModel = require("../src/database/database.js");

describe("GET /", () => {
  it("responds with welcome message", async () => {
    const response = await request(app).get("/");
    console.log(response.body);
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("message", "welcome to JWT Pizza");
    expect(response.body).toHaveProperty("version");
  });
});

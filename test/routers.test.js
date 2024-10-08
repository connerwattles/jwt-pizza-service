const request = require("supertest");
const express = require("express");
const franchiseRouter = require("../src/routes/franchiseRouter");
const { DB, Role } = require("../src/database/database");
const { authRouter } = require("../src/routes/authRouter");

jest.mock("../src/database/database", () => ({
  DB: {
    getFranchises: jest
      .fn()
      .mockResolvedValue([{ id: 1, name: "Franchise 1" }]),
    getUserFranchises: jest
      .fn()
      .mockResolvedValue([{ id: 1, name: "Franchise 1" }]),
    createFranchise: jest
      .fn()
      .mockResolvedValue({ id: 1, name: "New Franchise" }),
    getFranchise: jest.fn(),
    createStore: jest.fn(),
    deleteStore: jest.fn(), // Add a mock deleteStore function
    initializeDatabase: jest.fn(),
    close: jest.fn(),
  },
  Role: jest.fn(),
}));
jest.mock("../src/routes/authRouter");

const app = express();
app.use(express.json());
app.use("/api/franchise", franchiseRouter);

describe("Franchise Router", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Close the database connection after all tests have run
    DB.close();
  });

  it("should list all franchises (GET /api/franchise)", async () => {
    const franchises = [
      { id: 1, name: "pizzaPocket", stores: [{ id: 1, name: "SLC" }] },
    ];
    DB.getFranchises.mockResolvedValue(franchises);

    const res = await request(app).get("/api/franchise");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(franchises);
    expect(DB.getFranchises).toHaveBeenCalled();
  });

  it("should list user franchises when authenticated (GET /api/franchise/:userId)", async () => {
    authRouter.authenticateToken.mockImplementation((req, res, next) => {
      req.user = { id: 4, isRole: jest.fn(() => true) }; // Mock user as Admin
      next();
    });
    const franchises = [
      {
        id: 2,
        name: "pizzaPocket",
        admins: [{ id: 4, name: "pizza franchisee" }],
      },
    ];
    DB.getUserFranchises.mockResolvedValue(franchises);

    const res = await request(app).get("/api/franchise/4");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(franchises);
    expect(DB.getUserFranchises).toHaveBeenCalledWith(4);
  });

  it("should create a franchise with Admin role (POST /api/franchise)", async () => {
    authRouter.authenticateToken.mockImplementation((req, res, next) => {
      req.user = { isRole: jest.fn((role) => role === Role.Admin) }; // Mock user as Admin
      next();
    });
    DB.createFranchise.mockResolvedValue({ id: 1, name: "pizzaPocket" });

    const res = await request(app)
      .post("/api/franchise")
      .send({ name: "pizzaPocket" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ id: 1, name: "pizzaPocket" });
    expect(DB.createFranchise).toHaveBeenCalledWith({ name: "pizzaPocket" });
  });

  it("should create a store under a franchise (POST /api/franchise/:franchiseId/store)", async () => {
    authRouter.authenticateToken.mockImplementation((req, res, next) => {
      req.user = { id: 4, isRole: jest.fn(() => true) }; // Admin
      next();
    });
    DB.getFranchise.mockResolvedValue({ id: 1, admins: [{ id: 4 }] });
    DB.createStore.mockResolvedValue({ id: 1, franchiseId: 1, name: "SLC" });

    const res = await request(app)
      .post("/api/franchise/1/store")
      .send({ name: "SLC" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ id: 1, franchiseId: 1, name: "SLC" });
    expect(DB.createStore).toHaveBeenCalledWith(1, { name: "SLC" });
  });

  it("should delete a store under a franchise (DELETE /api/franchise/:franchiseId/store/:storeId)", async () => {
    authRouter.authenticateToken.mockImplementation((req, res, next) => {
      req.user = { id: 4, isRole: jest.fn(() => true) }; // Admin
      next();
    });
    DB.getFranchise.mockResolvedValue({ id: 1, admins: [{ id: 4 }] });
    DB.deleteStore.mockResolvedValue();

    const res = await request(app).delete("/api/franchise/1/store/1");
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("store deleted");
    expect(DB.deleteStore).toHaveBeenCalledWith(1, 1);
  });
});

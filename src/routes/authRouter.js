const express = require("express");
const jwt = require("jsonwebtoken");
const config = require("../config.js");
const { asyncHandler } = require("../endpointHelper.js");
const { DB, Role } = require("../database/database.js");

const { metrics } = require("../metrics.js");

const authRouter = express.Router();

const logger = require("../logger.js");

authRouter.endpoints = [
  {
    method: "POST",
    path: "/api/auth",
    description: "Register a new user",
    example: `curl -X POST localhost:3000/api/auth -d '{"name":"pizza diner", "email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json'`,
    response: {
      user: {
        id: 2,
        name: "pizza diner",
        email: "d@jwt.com",
        roles: [{ role: "diner" }],
      },
      token: "tttttt",
    },
  },
  {
    method: "PUT",
    path: "/api/auth",
    description: "Login existing user",
    example: `curl -X PUT localhost:3000/api/auth -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json'`,
    response: {
      user: {
        id: 1,
        name: "常用名字",
        email: "a@jwt.com",
        roles: [{ role: "admin" }],
      },
      token: "tttttt",
    },
  },
  {
    method: "PUT",
    path: "/api/auth/:userId",
    requiresAuth: true,
    description: "Update user",
    example: `curl -X PUT localhost:3000/api/auth/1 -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json' -H 'Authorization: Bearer tttttt'`,
    response: {
      id: 1,
      name: "常用名字",
      email: "a@jwt.com",
      roles: [{ role: "admin" }],
    },
  },
  {
    method: "DELETE",
    path: "/api/auth",
    requiresAuth: true,
    description: "Logout a user",
    example: `curl -X DELETE localhost:3000/api/auth -H 'Authorization: Bearer tttttt'`,
    response: { message: "logout successful" },
  },
];

async function setAuthUser(req, res, next) {
  const token = readAuthToken(req);
  if (token) {
    try {
      if (await DB.isLoggedIn(token)) {
        // Check the database to make sure the token is valid.
        req.user = jwt.verify(token, config.jwtSecret);
        req.user.isRole = (role) =>
          !!req.user.roles.find((r) => r.role === role);
      }
    } catch {
      req.user = null;
    }
  }
  next();
}

// Authenticate token
authRouter.authenticateToken = (req, res, next) => {
  if (!req.user) {
    return res.status(401).send({ message: "unauthorized" });
  }
  next();
};

// register
authRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      logger.log("warn", "auth", {
        event: "registration_failed",
        reason: "missing_fields",
        body: req.body,
      });
      return res
        .status(400)
        .json({ message: "name, email, and password are required" });
    }

    const user = await DB.addUser({
      name,
      email,
      password,
      roles: [{ role: Role.Diner }],
    });

    const auth = await setAuth(user);
    logger.log("info", "auth", {
      event: "user_registered",
      userId: user.id,
      email,
    });
    res.json({ user: user, token: auth });
  })
);

// login
authRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await DB.getUser(email, password);

    if (user) {
      const auth = await setAuth(user);
      metrics.incrementActiveUsers();
      logger.log("info", "auth", {
        event: "login_success",
        userId: user.id,
        email,
      });
      res.json({ user: user, token: auth });
    } else {
      metrics.incrementAuth(false);
      logger.log("warn", "auth", { event: "login_failed", email });
      res.status(401).json({ message: "Invalid credentials" });
    }
  })
);

// logout
authRouter.delete(
  "/",
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const token = readAuthToken(req);

    if (token) {
      await clearAuth(req);
      metrics.decrementActiveUsers();
      logger.log("info", "auth", {
        event: "logout_success",
        userId: req.user.id,
      });
      res.json({ message: "logout successful" });
    } else {
      logger.log("warn", "auth", {
        event: "logout_failed",
        reason: "no_token_provided",
      });
      res.status(400).json({ message: "No token provided" });
    }
  })
);

// updateUser
authRouter.put(
  "/:userId",
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const userId = Number(req.params.userId);
    const user = req.user;

    if (user.id !== userId && !user.isRole(Role.Admin)) {
      metrics.incrementAuth(false);
      logger.log("warn", "auth", {
        event: "update_user_unauthorized",
        userId,
        requesterId: user.id,
      });
      return res.status(403).json({ message: "unauthorized" });
    }

    metrics.incrementAuth(true);
    const updatedUser = await DB.updateUser(userId, email, password);
    logger.log("info", "auth", {
      event: "user_updated",
      userId,
      updatedFields: { email },
    });
    res.json(updatedUser);
  })
);

async function setAuth(user) {
  const token = jwt.sign(user, config.jwtSecret);
  await DB.loginUser(user.id, token);
  return token;
}

async function clearAuth(req) {
  const token = readAuthToken(req);
  if (token) {
    await DB.logoutUser(token);
  }
}

function readAuthToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    return authHeader.split(" ")[1];
  }
  return null;
}

module.exports = { authRouter, setAuthUser };

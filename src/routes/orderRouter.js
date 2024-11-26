const express = require("express");
const config = require("../config.js");
const { Role, DB } = require("../database/database.js");
const { authRouter } = require("./authRouter.js");
const { asyncHandler, StatusCodeError } = require("../endpointHelper.js");

const { metrics } = require("../metrics.js");

const orderRouter = express.Router();

const logger = require("../logger.js");

orderRouter.endpoints = [
  {
    method: "GET",
    path: "/api/order/menu",
    description: "Get the pizza menu",
    example: `curl localhost:3000/api/order/menu`,
    response: [
      {
        id: 1,
        title: "Veggie",
        image: "pizza1.png",
        price: 0.0038,
        description: "A garden of delight",
      },
    ],
  },
  {
    method: "PUT",
    path: "/api/order/menu",
    requiresAuth: true,
    description: "Add an item to the menu",
    example: `curl -X PUT localhost:3000/api/order/menu -H 'Content-Type: application/json' -d '{ "title":"Student", "description": "No topping, no sauce, just carbs", "image":"pizza9.png", "price": 0.0001 }'  -H 'Authorization: Bearer tttttt'`,
    response: [
      {
        id: 1,
        title: "Student",
        description: "No topping, no sauce, just carbs",
        image: "pizza9.png",
        price: 0.0001,
      },
    ],
  },
  {
    method: "GET",
    path: "/api/order",
    requiresAuth: true,
    description: "Get the orders for the authenticated user",
    example: `curl -X GET localhost:3000/api/order  -H 'Authorization: Bearer tttttt'`,
    response: {
      dinerId: 4,
      orders: [
        {
          id: 1,
          franchiseId: 1,
          storeId: 1,
          date: "2024-06-05T05:14:40.000Z",
          items: [{ id: 1, menuId: 1, description: "Veggie", price: 0.05 }],
        },
      ],
      page: 1,
    },
  },
  {
    method: "POST",
    path: "/api/order",
    requiresAuth: true,
    description: "Create a order for the authenticated user",
    example: `curl -X POST localhost:3000/api/order -H 'Content-Type: application/json' -d '{"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]}'  -H 'Authorization: Bearer tttttt'`,
    response: {
      order: {
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: 1, description: "Veggie", price: 0.05 }],
        id: 1,
      },
      jwt: "1111111111",
    },
  },
];

// getMenu
orderRouter.get(
  "/menu",
  asyncHandler(async (req, res) => {
    const menu = await DB.getMenu();
    logger.log("info", "order", { event: "get_menu", count: menu.length });
    res.send(menu);
  })
);

// addMenuItem
orderRouter.put(
  "/menu",
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    if (!req.user.isRole(Role.Admin)) {
      logger.log("warn", "order", {
        event: "add_menu_item_unauthorized",
        userId: req.user.id,
      });
      throw new StatusCodeError("unable to add menu item", 403);
    }

    const addMenuItemReq = req.body;
    await DB.addMenuItem(addMenuItemReq);
    const menu = await DB.getMenu();
    logger.log("info", "order", {
      event: "menu_item_added",
      userId: req.user.id,
      menuItem: addMenuItemReq,
    });
    res.send(menu);
  })
);

// getOrders
orderRouter.get(
  "/",
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const page = req.query.page || 1;
    const orders = await DB.getOrders(req.user, page);
    logger.log("info", "order", {
      event: "get_orders",
      userId: req.user.id,
      page,
      count: orders.length,
    });
    res.json(orders);
  })
);

// createOrder
orderRouter.post(
  "/",
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const orderReq = req.body;
    const startTime = Date.now();
    const order = await DB.addDinerOrder(req.user, orderReq);

    logger.log("info", "order", {
      event: "order_created",
      userId: req.user.id,
      order,
    });

    try {
      const r = await fetch(`${config.factory.url}/api/order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${config.factory.apiKey}`,
        },
        body: JSON.stringify({
          diner: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
          },
          order,
        }),
      });

      const j = await r.json();
      if (r.ok) {
        let totalRevenue = 0;
        order.items.forEach((item) => {
          metrics.recordPizzaSale(item.price);
          totalRevenue += item.price;
        });

        metrics.sendMetricToGrafana("pizza", "revenue", "total", totalRevenue);

        const latency = Date.now() - startTime;
        metrics.sendMetricToGrafana(
          "latency",
          "pizza_creation",
          "response_time",
          latency
        );

        logger.log("info", "order", {
          event: "order_fulfilled",
          userId: req.user.id,
          orderId: order.id,
          latency,
          totalRevenue,
        });

        res.send({ order, jwt: j.jwt, reportUrl: j.reportUrl });
      } else {
        metrics.recordPizzaFailure();
        logger.log("error", "order", {
          event: "factory_fulfillment_failed",
          userId: req.user.id,
          orderId: order.id,
          factoryResponse: j,
        });
        res.status(500).send({
          message: "Failed to fulfill order at factory",
          reportUrl: j.reportUrl,
        });
      }
    } catch (err) {
      metrics.recordPizzaFailure();
      logger.log("error", "order", {
        event: "factory_service_error",
        error: err.message,
        userId: req.user.id,
        orderId: order.id,
      });
      res.status(500).send({ message: "Internal Server Error" });
    }
  })
);

module.exports = orderRouter;

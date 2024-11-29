import { sleep, check, group, fail } from "k6";
import http from "k6/http";

export const options = {
  cloud: {
    distribution: {
      "amazon:us:ashburn": { loadZone: "amazon:us:ashburn", percent: 100 },
    },
    apm: [],
  },
  thresholds: {},
  scenarios: {
    Scenario_1: {
      executor: "ramping-vus",
      gracefulStop: "30s",
      stages: [
        { target: 5, duration: "30s" },
        { target: 15, duration: "1m" },
        { target: 10, duration: "30s" },
        { target: 0, duration: "30s" },
      ],
      gracefulRampDown: "30s",
      exec: "scenario_1",
    },
  },
};

export function scenario_1() {
  let response;

  group("JWT Pizza Service Workflow", function () {
    // Step 1: Homepage
    response = http.get("https://pizza.smittywerb.click/", {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    check(response, {
      "Homepage loaded successfully": (r) => r.status === 200,
    });
    sleep(1);

    // Step 2: Login
    response = http.put(
      "https://pizza-service.smittywerb.click/api/auth",
      JSON.stringify({ email: "d@jwt.com", password: "diner" }),
      {
        headers: {
          "content-type": "application/json",
        },
      }
    );
    if (!check(response, { "Login successful": (r) => r.status === 200 })) {
      console.log("Login failed: ", response.body);
      fail("Login request failed.");
    }
    const authToken = response.json("token"); // Extract authentication token dynamically
    sleep(1);

    // Step 3: Get menu
    response = http.get(
      "https://pizza-service.smittywerb.click/api/order/menu",
      {
        headers: {
          accept: "*/*",
          authorization: `Bearer ${authToken}`,
        },
      }
    );
    check(response, { "Menu loaded successfully": (r) => r.status === 200 });
    sleep(1);

    // Step 4: Get franchise
    response = http.get(
      "https://pizza-service.smittywerb.click/api/franchise",
      {
        headers: {
          accept: "*/*",
          authorization: `Bearer ${authToken}`,
        },
      }
    );
    check(response, {
      "Franchise loaded successfully": (r) => r.status === 200,
    });
    sleep(1);

    // Step 5: Purchase pizza
    response = http.post(
      "https://pizza-service.smittywerb.click/api/order",
      JSON.stringify({
        items: [{ menuId: 1, description: "Veggie", price: 0.0038 }],
        storeId: "1",
        franchiseId: 1,
      }),
      {
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${authToken}`,
        },
      }
    );
    if (!check(response, { "Purchase successful": (r) => r.status === 200 })) {
      console.log("Purchase failed: ", response.body);
      fail("Purchase request failed.");
    }
    const pizzaJWT = response.json("jwt"); // Dynamically extract pizza JWT
    sleep(1);

    // Step 6: Verify pizza
    response = http.post(
      "https://pizza-factory.cs329.click/api/order/verify",
      JSON.stringify({ jwt: pizzaJWT }),
      {
        headers: {
          "content-type": "application/json",
        },
      }
    );
    if (
      !check(response, {
        "Pizza verification successful": (r) => r.status === 200,
      })
    ) {
      console.log("Pizza verification failed: ", response.body);
      fail("Pizza verification request failed.");
    }
    sleep(1);
  });
}

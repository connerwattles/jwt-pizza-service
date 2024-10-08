const request = require("supertest");
const app = require("../src/service");
const { DB, Role } = require("../src/database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

beforeEach(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUser.id = registerRes.body.user.id;
  expectValidJwt(testUserAuthToken);
  expect(testUser.id).toBeDefined();
});

test("get the pizza menu", async () => {
  const res = await request(app).get("/api/order/menu");

  expect(res.statusCode).toEqual(200);
});

test("add a menu item", async () => {
  const menuItem = {
    title: "Student",
    description: "No topping, no sauce, just carbs",
    image: "pizza9.png",
    price: 0.0001,
  };

  adminUser = await createAdminUser();
  const loginRes = await request(app).put("/api/auth").send(adminUser);
  adminUserAuthToken = loginRes.body.token;

  const res = await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${adminUserAuthToken}`)
    .send(menuItem);

  expect(res.statusCode).toEqual(200);
  expect(res.body).toContainEqual(expect.objectContaining(menuItem));
});

test("get the orders for the authenticated user", async () => {
  const res = await request(app)
    .get("/api/order")
    .set("Authorization", `Bearer ${testUserAuthToken}`);

  expect(res.statusCode).toEqual(200);
  expect(Array.isArray(res.body.orders)).toBe(true);
});

// test("create an order for the authenticated user", async () => {
//   const franchiseId = 2;
//   const franchiseName =
//     "New Franchisee" + Math.random().toString(36).substring(2, 12);

//   const temp = await request(app)
//     .post("/api/franchise")
//     .set("Authorization", `Bearer ${adminUserAuthToken}`)
//     .send({
//       name: franchiseName,
//       admins: [{ email: testUser.email }],
//       id: franchiseId,
//     });

//   const storeRes = await request(app)
//     .post(`/api/franchise/${franchiseId}/store`)
//     .set("Authorization", `Bearer ${adminUserAuthToken}`)
//     .send({ franchiseId, name: "New Store" });

//   const order = {
//     franchiseId: 2,
//     storeId: 2,
//     items: [{ menuId: 1, description: "Veggie", price: 0.05 }],
//   };

//   const res = await request(app)
//     .post("/api/order")
//     .set("Authorization", `Bearer ${testUserAuthToken}`)
//     .send(order);

//   console.log("Response Body:", res.body);
//   console.log("Response Status:", res.statusCode);

//   expect(res.statusCode).toEqual(200);
//   expect(res.body.order).toMatchObject(order);
//   expect(typeof res.body.jwt).toBe("string");
//   expect(res.body.reportUrl).toBeDefined();
// });

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}

async function createAdminUser() {
  let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + "@admin.com";

  await DB.addUser(user);
  console.log("Admin User:", user);
  return { ...user, password: "toomanysecrets" };
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

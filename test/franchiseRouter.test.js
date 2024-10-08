const request = require("supertest");
const app = require("../src/service");
const { DB, Role } = require("../src/database/database.js");

let adminUser;
let adminUserAuthToken;

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

test("get all franchises", async () => {
  const res = await request(app)
    .get("/api/franchise")
    .set("Authorization", `Bearer ${testUserAuthToken}`);

  expect(res.status).toBe(200);
});

test("get user's franchises", async () => {
  const res = await request(app)
    .get(`/api/franchise/${testUserAuthToken}`)
    .set("Authorization", `Bearer ${testUserAuthToken}`);

  expect(res.status).toBe(200);
});

test("create and delete a franchise", async () => {
  adminUser = await createAdminUser();
  const loginRes = await request(app).put("/api/auth").send(adminUser);
  adminUserAuthToken = loginRes.body.token;

  const franchiseId = 1;
  const franchiseName =
    "Newer Franchisee" + Math.random().toString(36).substring(2, 12);

  const res = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminUserAuthToken}`)
    .send({
      name: franchiseName,
      admins: [{ email: testUser.email }],
      id: franchiseId,
    });

  expect(res.status).toBe(200);
  expect(res.body.name).toBe(franchiseName);

  const deleteRes = await request(app)
    .delete(`/api/franchise/${franchiseId}`)
    .set("Authorization", `Bearer ${adminUserAuthToken}`);

  expect(deleteRes.status).toBe(200);
  expect(deleteRes.body.message).toBe("franchise deleted");
});

test("create and delete a franchise store", async () => {
  adminUser = await createAdminUser();
  const loginRes = await request(app).put("/api/auth").send(adminUser);
  adminUserAuthToken = loginRes.body.token;

  const franchiseName =
    "New Franchisee" + Math.random().toString(36).substring(2, 12);

  const temp = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminUserAuthToken}`)
    .send({
      name: franchiseName,
      admins: [{ email: testUser.email }],
    });

  console.log("Response body:", temp.body);
  franchiseStoreId = temp.body.id;

  expect(temp.status).toBe(200);

  const res = await request(app)
    .post(`/api/franchise/${franchiseStoreId}/store`)
    .set("Authorization", `Bearer ${adminUserAuthToken}`)
    .send({ franchiseStoreId, name: "New Store" });

  console.log("Response Status:", res.status);
  console.log("Response Body:", res.body.message);

  expect(res.status).toBe(200);
  expect(res.body.name).toBe("New Store");

  const deleteRes = await request(app)
    .delete(`/api/franchise/${franchiseStoreId}/store/1`)
    .set("Authorization", `Bearer ${adminUserAuthToken}`);

  expect(deleteRes.status).toBe(200);
  expect(deleteRes.body.message).toBe("store deleted");
});

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

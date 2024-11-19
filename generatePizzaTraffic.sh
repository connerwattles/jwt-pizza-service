#!/bin/bash

# Check if a host is provided as a parameter
if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  exit 1
fi

host=$1

# Function to clean up background processes on CTRL-C
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Request menu every 3 seconds
while true; do
  echo "Requesting menu..."
  curl -s $host/api/order/menu
  sleep 3
done &

# Invalid login every 25 seconds
while true; do
  echo "Logging in with invalid credentials..."
  curl -s -X PUT $host/api/auth -d '{"email":"unknown@jwt.com", "password":"bad"}' -H 'Content-Type: application/json'
  sleep 25
done &

# Login and logout every two minutes
while true; do
  echo "Login franchisee..."
  response=$(curl -s -X PUT $host/api/auth -d '{"email":"f@jwt.com", "password":"franchisee"}' -H 'Content-Type: application/json')
  token=$(echo $response | jq -r '.token')
  sleep 110
  curl -X DELETE $host/api/auth -H "Authorization: Bearer $token"
  echo "Logout franchisee..."
  sleep 10
done &

# Login, buy pizza, wait, and logout
while true; do
  echo "Login diner..."
  response=$(curl -s -X PUT $host/api/auth -d '{"email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json')
  token=$(echo $response | jq -r '.token')
  echo "Bought a pizza..."
  curl -s -X POST $host/api/order -H 'Content-Type: application/json' -d '{"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]}' -H "Authorization: Bearer $token"
  sleep 20
  curl -X DELETE $host/api/auth -H "Authorization: Bearer $token"
  echo "Logout diner..."
  sleep 30
done &

# Login diner and check response
response=$(curl -s -X PUT $host/api/auth -d '{"email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json')
echo "Diner login response: $response" # Log login response
token=$(echo $response | jq -r '.token')

if [ "$token" == "null" ] || [ -z "$token" ]; then
  echo "Failed to login diner: no token received."
else
  echo "Diner logged in successfully with token: $token"
  # Attempt to place an order
  orderResponse=$(curl -s -X POST $host/api/order -H 'Content-Type: application/json' -H "Authorization: Bearer $token" -d '{"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]}')
  echo "Order response: $orderResponse" # Log order response
fi


# Wait for background processes to complete
wait


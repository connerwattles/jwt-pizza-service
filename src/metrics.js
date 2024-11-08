const config = require("./config.js");

class Metrics {
  constructor() {
    // Store the total requests for each HTTP method (GET, POST, DELETE)
    this.totalRequests = { GET: 0, POST: 0, DELETE: 0 };

    // This will periodically send metrics to Grafana every 10 seconds
    const timer = setInterval(() => {
      Object.keys(this.totalRequests).forEach((method) => {
        this.sendMetricToGrafana(
          "request",
          method,
          "total",
          this.totalRequests[method]
        );
      });
    }, 10000);

    // Unref the timer so that the event loop can continue running without waiting for it
    timer.unref();
  }

  // Increment the request count for a given HTTP method
  incrementRequests(method) {
    if (this.totalRequests[method] !== undefined) {
      this.totalRequests[method]++;
    }
  }

  // Send a metric to Grafana in the required format
  sendMetricToGrafana(metricPrefix, httpMethod, metricName, metricValue) {
    const metric = `${metricPrefix},source=${config.metrics.source},method=${httpMethod} ${metricName}=${metricValue}`;

    // Send the metric via HTTP POST request to Grafana
    fetch(`${config.metrics.url}`, {
      method: "POST",
      body: metric,
      headers: {
        Authorization: `Bearer ${config.metrics.userId}:${config.metrics.apiKey}`,
      },
    })
      .then((response) => {
        if (!response.ok) {
          console.error("Failed to push metrics data to Grafana");
        } else {
          console.log(`Pushed ${metric}`);
        }
      })
      .catch((error) => {
        console.error("Error pushing metrics:", error);
      });
  }

  // Middleware function to track HTTP requests
  requestTracker(req, res, next) {
    const method = req.method;

    // Increment the request count for the HTTP method
    this.incrementRequests(method);

    // Call the next middleware or route handler
    next();
  }
}

// Create a new instance of Metrics
const metrics = new Metrics();

// Export the metrics instance and the requestTracker middleware
module.exports = {
  metrics,
  requestTracker: metrics.requestTracker.bind(metrics), // Bind the correct context for requestTracker
};

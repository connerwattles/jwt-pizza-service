const config = require("./config.js");
const os = require("os");

class Metrics {
  constructor() {
    this.totalRequests = { GET: 0, POST: 0, DELETE: 0 };
    this.authAttempts = { success: 0, failure: 0 };
    this.pizzaTransactions = { sold: 0, failures: 0, revenue: 0 };
    this.activeUsers = 0;

    const timer = setInterval(() => {
      this.sendRequestMetrics();
      this.sendAuthMetrics();
      this.reportSystemMetrics();
      this.sendPizzaMetrics();
      this.sendActiveUserMetrics();
    }, 10000);

    timer.unref();
  }

  incrementRequests(method) {
    if (this.totalRequests[method] !== undefined) {
      this.totalRequests[method]++;
    }
  }

  incrementAuth(success) {
    if (success) {
      this.authAttempts.success++;
    } else {
      this.authAttempts.failure++;
    }
  }

  incrementActiveUsers() {
    this.activeUsers++;
  }

  decrementActiveUsers() {
    if (this.activeUsers > 0) this.activeUsers--;
  }

  recordPizzaSale(price) {
    this.pizzaTransactions.sold++;
    this.pizzaTransactions.revenue += price;
  }

  recordPizzaFailure() {
    this.pizzaTransactions.failures++;
  }

  reportSystemMetrics() {
    const cpuUsage = (os.loadavg()[0] / os.cpus().length) * 100;
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;

    this.sendMetricToGrafana("system", "cpu", "usage", cpuUsage.toFixed(2));
    this.sendMetricToGrafana(
      "system",
      "memory",
      "usage",
      memoryUsage.toFixed(2)
    );
  }

  sendMetricToGrafana(metricPrefix, method, metricName, metricValue) {
    //const metric = `${metricPrefix},source=${config.metrics.source},method=${method} ${metricName}=${metricValue}`;
    const metric =
      "metric=" +
      metricPrefix +
      ",source=" +
      config.metrics.source +
      ",method=" +
      method +
      " " +
      metricName +
      "=" +
      metricValue;

    fetch(`${config.metrics.url}`, {
      method: "POST",
      body: metric,
      headers: {
        Authorization: `Bearer ${config.metrics.userId}:${config.metrics.apiKey}`,
      },
    })
      .then((response) => {
        if (!response.ok) {
          //console.error("Failed to push metrics data to Grafana");
        } else {
          //console.log(`Pushed ${metric}`);
        }
      })
      .catch((error) => {
        //console.error("Error pushing metrics:", error);
      });
  }

  sendRequestMetrics() {
    Object.keys(this.totalRequests).forEach((method) => {
      this.sendMetricToGrafana(
        "request",
        method,
        "total",
        this.totalRequests[method]
      );
      this.totalRequests[method] = 0;
    });
  }

  sendAuthMetrics() {
    // console.log(
    //   `Sending auth metrics: success=${this.authAttempts.success}, failure=${this.authAttempts.failure}`
    // );
    this.sendMetricToGrafana(
      "auth",
      "success",
      "attempts",
      this.authAttempts.success
    );
    this.sendMetricToGrafana(
      "auth",
      "failure",
      "attempts",
      this.authAttempts.failure
    );
    this.authAttempts = { success: 0, failure: 0 };
  }

  sendPizzaMetrics() {
    this.sendMetricToGrafana(
      "pizza",
      "sold",
      "total",
      this.pizzaTransactions.sold
    );
    this.sendMetricToGrafana(
      "pizza",
      "failures",
      "total",
      this.pizzaTransactions.failures
    );
    this.sendMetricToGrafana(
      "pizza",
      "revenue",
      "total",
      this.pizzaTransactions.revenue
    );
    this.pizzaTransactions = { sold: 0, failures: 0, revenue: 0 };
  }

  sendActiveUserMetrics() {
    //console.log(`Active users: ${this.activeUsers}`);
    this.sendMetricToGrafana("user", "active", "count", this.activeUsers);
  }

  requestTracker(req, res, next) {
    const method = req.method;
    this.incrementRequests(method);

    const startTime = Date.now();
    res.on("finish", () => {
      const latency = Date.now() - startTime;
      this.sendMetricToGrafana("latency", req.path, "response_time", latency);
    });

    next();
  }
}

const metrics = new Metrics();

module.exports = {
  metrics,
  requestTracker: metrics.requestTracker.bind(metrics),
};

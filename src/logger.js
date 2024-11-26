const fetch = require("node-fetch");
const config = require("./config");

class Logger {
  // HTTP request logger middleware
  httpLogger = (req, res, next) => {
    const startTime = Date.now();
    let send = res.send;

    res.send = (resBody) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: this.sanitize(req.body),
        resBody: this.sanitize(resBody),
        responseTime: `${Date.now() - startTime}ms`,
      };

      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, "http", logData);

      res.send = send;
      return res.send(resBody);
    };

    next();
  };

  // General log method
  log(level, type, logData) {
    const labels = { component: config.logging.source, level, type };
    const values = [this.nowString(), JSON.stringify(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }

  // Log for database queries
  logDBQuery(query, params) {
    const logData = {
      query,
      parameters: this.sanitize(params),
    };
    this.log("info", "db_query", logData);
  }

  // Log for factory service requests
  logFactoryRequest(endpoint, requestData, responseData) {
    const logData = {
      endpoint,
      requestData: this.sanitize(requestData),
      responseData: this.sanitize(responseData),
    };
    this.log("info", "factory_service", logData);
  }

  // Log for errors
  logError(error, context = {}) {
    const logData = {
      message: error.message,
      stack: error.stack,
      context: this.sanitize(context),
    };
    this.log("error", "exception", logData);
  }

  // Helper: Determine log level based on status code
  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return "error";
    if (statusCode >= 400) return "warn";
    return "info";
  }

  // Helper: Current timestamp in nanoseconds
  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  // Helper: Sanitize sensitive data
  sanitize(data) {
    if (!data) return data;
    const strData = JSON.stringify(data);
    return strData
      .replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"')
      .replace(/\\"token\\":\s*\\"[^"]*\\"/g, '\\"token\\": \\"*****\\"');
  }

  // Send log to Grafana
  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(config.logging.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.logging.userId}:${config.logging.apiKey}`,
      },
      body,
    })
      .then((res) => {
        if (!res.ok)
          console.error("Failed to send log to Grafana:", res.statusText);
      })
      .catch((err) => console.error("Error sending log to Grafana:", err));
  }
}

module.exports = new Logger();

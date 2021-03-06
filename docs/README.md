# API Reference

## Top-Level Exports

- [`createServer(options)`](#createserveroptions)
- [`koaHealthy(options)`](#koahealthyoptions)
- [`createHealthCheck(name)`](#createhealthcheckname)
- [`httpGetJson(options)`](#httpgetjsonoptions)

### Importing

Every function described above is a top-level export.
You can import any of them like this:

```js
import { createServer } from '@meltwater/mlabs-koa'
```

---
### `createServer(options)`

Provide configuration and dependencies to run the Koa server.
Creates a [logger], mounts the app with all enabled middleware,
and controls process lifecycle.
An [Awilix] container will be scoped for each request
under `ctx.state.container`.

#### Arguments

1. `options` (*object*):
    - `configPath` (*string*):
      Full path to the configuration directory.
      See [Middleware and Config](#config-and-middleware) below.
    - `createDependencies` (*function*):
      Function which takes an object `{config, log}`
      (a [logger] and a [confit] config object)
      and returns an [Awilix] container.
      See [Dependencies](#dependencies) below.
    - `logFilters`: Object of named log output filters available
      via the log `filter` config value.
      See the `log` config section below and
      the [logger documentation] for `outputFilter`.

#### Returns

(*object*):
  - `configFactory` (*object*):
    The [confit] config factory.
  - `run` (*function*):
    Takes a single argument, the confit config factory,
    and starts the Koa server.
  - `exit` (*function*):
    Takes a single argument, the error, then immediately logs the error
    and exits the process with exit code 2.
    If no error is passed, the exit code will be 0.
  - `watcher` (*object*):
    The initial `chokidar` watcher for config file changes.
    If loading config data before calling `run`,
    ensure to wait for the `ready` event before reading any config files.
  - `ready`: (*boolean*): If the watcher ready event has fired.

#### Example

```js
const { configFactory, run } = createServer({
  configPath: path.resolve(__dirname, 'config'),
  createDependencies
})

run(configFactory)
```

---
### `koaHealthy(options)`

Standalone middleware that always sets either a 200 or 503 status code.
It is meant to be used for an API health endpoint
to verify minimal connectivity.

If the request accepts JSON, it will set the body to either
`{"healthy": true}` or `{"healthy": false}`.

This middleware is mounted at `/ping` by default.

#### Arguments

1. `options` (*object*):
    - `isHealthy` (*boolean*):
      If the middleware will set 200 or 503 status.
      Default: true.

---
### `createHealthCheck(name)`

Function for creating health checks from registered dependencies.

Takes the name of a dependency and returns a function
that accepts the container and returns the resolved dependency by name.
A scope is created with a child logger setting `isHealthLog` true.

#### Arguments

1. `name` (*string* **required**):
   The name of the dependency to resolve for the health check.

#### Returns

(*function*) Health check to use with `createHealthMonitor`

#### Example

```
import { createHealthMonitor } from '@meltwater/mlabs-health'

createHealthMonitor({
  puppies: createHealthCheck('puppies')
})
```

---
### `httpGetJson(options)`

Convenience method for making a single http GET request
and returning the parsed JSON response wrapped in a promise.
Not intended for production, but may be useful for simple examples and debugging
as it has no external dependencies.

#### Arguments

1. `options` (*object*): The options to pass to `http.request`.

#### Returns

(*object*): A promise for the parsed JSON response.

## Dependencies

The `createDependencies` function will be passed an object with
`log` (a [logger]) and `config` (a [confit] config object).
Use `config.get('a:b:c')` to pass configuration to dependencies.

The following dependencies are used by the module
and may be registered in `createDependencies`
(if missing, default ones will be registered):

- `log`: A [logger] instance.
- `healthMonitor`: A [Health Monitor].
  Each health check will be called with the [Awilix] container.
- `healthMethods`: Health methods to determine health status
  for each health endpoint.
  See [createHealthy].
  The `health` key must be provided and will be used by default
  for any unspecified health checks.
- `start`: Async function to wait on before server is ready:
  called after server has started accepting new connections.
- `stop`: Async function to wait on before server shutdown:
  called after server has stopped accepting new connections.
- `app`: The Koa app to mount.
- `server`: The HTTP server (cannot be overridden).

### Metrics

Additionally, the following optional dependencies are registered
to support custom app metrics.
Only `metricDefs` needs to be registered to get app metrics.

To define app metrics, simply register `metricDefs`
and call `collectAppMetrics` on start.
Access individual metrics via the `metrics` dependency.
The `metrics` config property may be used for run-time customization.
See the server example for how to define and use custom metrics.

- `metricDefs`: Array of metric definitions (see below).
- `metrics` (also aliased to `appMetrics`):
  An object of the defined Prometheus metrics (see below).
  This is generated automatically and should not need to be overridden.
- `metricPrefix`: Prefix to prepend to all app metrics.
  Set via config property `metrics.prefix`.
  Default is `koa_app_`.
- `metricOptions`: Options to merge into metrics definitions.
  Set via config property `metrics.options`.
- `registry`: A [Prometheus Registry].
- `collectAppMetrics`: Function which takes `{register}` and registers all app metrics.

#### Metric Definitions

Each must has a `type` whose value is the metric constructor.
The remaining properties will be passed to the constructor
and registered with the registry.

For example,

```js
import { Counter } from 'prom-client'

const metricDefs = [{
  name: 'metric_name',
  help: 'Metic help',
  labels: ['metric_label'],
  type: Counter
}]
```

On app start, call `collectAppMetrics({ register })`,
then metrics may be accessed (without using the prefix) via

```js
metrics.metric_name.inc()
```

## Config and Middleware

_Middleware behavior is defined below along with it's configuration._

The `configPath` must point to a path containing a set of [confit] config files.

Since the config factory is returned before the server starts up,
more files may be loaded and the configuration may be modified
before passing it to `run`.

In addition to the standard behavior of [confit],
the following is true:

- The default config file is named `default.json` (not `config.json`).
- If `env.d` exists, all non-hidden JSON files under that directory
  will be loaded in alphabetical order as override files.
  Then, if `env.json` exists, it will be loaded as an override file.
- If `local.d` exists, all non-hidden JSON files under that directory
  will be loaded in alphabetical order as final override files.
  Then, if `local.json` exists, it will be loaded as a final override file.
- If `secret.d` exists, the whitespace-trimmed contents of each non-hidden file
  under that directory will be added to the config under `secret`
  with its key equal to the filename.
- The key `config` will contain the `configPath`.
- The key `pkg` will contain the contents of `package.json` from the
  current working directory.

### Config options

All configuration options have sensible defaults
so no config options are required.

#### `port`

The port number to run the server on.
Override with `PORT`.
Default is `80`.

#### `startupDelay`

The number of milliseconds the sever will wait before start.
Override with `STARTUP_DELAY`.
Default is `0`.

#### `shutdownDelay`

The number of milliseconds the sever will wait after receiving
SIGTERM or SIGINT before shutting down.
Override with `SHUTDOWN_DELAY`.
Default is `0`.

#### `shutdownOnChange`

If the server will initiate shutdown when it detects configuration changes.
Default is `true`.

#### `exitOnUnhandledRejection`

If the server will exit on the `unhandledRejection` event.
Default is `true`.

#### `exitOnFalseStart`

If the server will exit when the `start` promise rejects.
Default is `true`.

#### `shutdownTimeout`

Number of milliseconds to wait for `stop` promise to resolve
before forcibly exiting.
Default is `60000` (1 minute).

#### `log`

Object passed directly to the [logger] `createLogger` function.
Intelligent values are used for many properties if not overridden.

Some options are specific to this module
and used to determine log options; they are not passed through.

- The log level may be overridden with `level` or `LOG_LEVEL`.
- The `base` option will be merged with the standard Pino `base` defaults.
- The `outputMode` is only respected in development and ignored in production.
  Override with `LOG_OUTPUT_MODE`.
- The `filter` option is only respected in development and ignored in production.
  It must be the name of a filter defined in
  the `logFilters` option passed to `createDependencies`.
  Override with `LOG_FILTER`.
- See the [logger documentation] for an explanation
  of the `outputMode` and `outputFilter` options.
- When not in development, these additional options will add
  properties to the `base` logger:
    - `env`: Adds `@env` to logs (override with `LOG_ENV`).
      Default: not included.
    - `service`: Adds `@service` to logs (override with `LOG_SERVICE`).
      Default: automatically determined from the package name.
    - `system`: Adds `@system` to logs (override with `LOG_SYSTEM`).
      Default: automatically determined from the package name.
    - `version`: Adds `version` to logs (override with `LOG_VERSION`).
      Default: set from package and version.

#### `metrics`

- `prefix`: Prefix to prepend to all app metrics.
- `options`: Options to merge into each metric definition.

---
#### `koa`

Koa middleware configuration object:
each property is passed to the corresponding middleware.

All Middleware configuration takes an additional boolean
property `disable` which may be set to skip loading the middleware.
Third party middleware configuration is documented on
the corresponding project:
see the [links in the README](../README.md#middleware).

_The [logger] is attached under `ctx.state.log`
and the [Awilix] container is scoped per request under `ctx.state.container`
independently of any configuration below._

Each custom middleware configuration is documented below.

---
##### `responseTime`

- `resHeader`: Response header to use for the response time.
  Default: `x-response-time`.

Sets the response time header in milliseconds.

---
##### `requestId`

- `reqHeader`: Request header to use for the request id.
  Default: `x-request-id`.
- `resHeader`: Response header to use for the request id.
  Default: `x-request-id`.
- `paramName`: Request id will be stored or looked for in `ctx.state[paramName]`.
  Default: `reqId`.
- `generator`: Synchronous function to generate new ids.
  Default: UUID version 4.

Looks for a request id in the state or request header,
otherwise generates a new one to save in the state.
Passes the request id along in the response headers.

---
##### `logger`

- `useDev`: Use the simple development only logger.
  Default: infer from `NODE_ENV` (always disabled in production).
- `addReq`: Add `req` property to all logs generated from a request.
  Default: infer from `NODE_ENV` (enable for production).
- `reqNameHeader`: Header to use for the `reqName` to log.
  Default: `x-request-name`.
- `level`: Log level to log at.
  Default: `info`.

Logs the start and end of each request.

Adds the properties `reqId` from `ctx.state.reqId`
and `reqName` from the header defined by `reqNameHeader`
to all logs for each request.

In development, the [koa-logger] is used and passed the configuration.
In production, uses `ctx.state.log[level]` which logs
the `req` and `res` properties.
Toggle with the `useDev` option.

---
##### `error`

- `isLogged`: Log all errors.
  Works independently of the `disable` value.
  Default: true.
- `isServerErrorExposed`: Expose server errors (5xx status codes)
  to client in response body.
  Default: true.

Catches, wraps, and logs all errors as [Boom] errors.
If `ctx.status` is set to an HTTP error code,
a corresponding [Boom] error will be thrown.
Additional data passed to Boom errors is set under `data`.
Errors are sent as a response body in the standard format
(unless `ctx.body` is already set):

```json
{
  "error": "Internal Server Error",
  "message": "On fire!",
  "data": {"isOnFire": true},
  "status": 500,
  "statusCode": 500
}
```

---
##### `dependencyInjection`

For each request, registers `log` and `reqId` in the scoped container.

---
##### `cors`

Uses [koa-cors] but with these additional options:

- `origins`: List of origin globs to match that will allow CORS (uses [minimatch]).

---
##### `favicon`

Takes configuration for [koa-favicon](https://github.com/koajs/favicon)
with the additional property `path` which should be the full path
to the favicon file.

---
##### `robots`

- `rules`: Object containing named rules.
  Each property should be an array of strings,
  each of which will appear on it's own line in `robots.txt`.
  Default: set of predefined rules.
- `rule`: Name of the rule to use from `rules`.
  Default: `disallow`.

Serves `GET /robots.txt`.
Includes the rules `allow` and `disallow`.
Disallows all by default.

---
##### `metrics`

- `path`: Path to serve metrics.
  Default: `/metrics`.

Serves Prometheus metrics at `GET /metrics`
using `registry.metrics()`.
The `registry` must be registered as a dependency.

---
##### `ping`

- `path`: Path to serve ping.
  Default: `/ping`.
- `isHealthy`: If the ping returns success.

Serves ping at `GET /ping` using [`koaHealthy`](#koahealthyoptions).

---
##### `ready`

- `path`: Path to serve ready.
  Default: `/ready`.

Serves ready status at `GET /ready` using [`koaHealthy`](#koahealthyoptions).

This indicates the server is ready and able to serve requests.
The server is ready if the `start` promise has resolved,
the health status is not `false`,
the configuration has not changed since boot,
and the server is not in the process of shutting down.

The middleware will trigger background health checks on each request.

---
##### `health`

- `path`: Path to serve health.
  Default: `/health`

Serves healthy status at `GET /health`
and each individual healthy status at `GET /health/:name`.

Will trigger new health checks and wait for all
to resolve before responding.

The boolean health status is computed
from `healthMethods[name](healthMonitor[name].status())`.

---
##### `status`

- `path`: Path to serve status.
  Default: `/status`

Serves health monitor status at `GET /status`
and each individual health monitor status at `GET /status/:name`.

The status is retrieved from `healthMonitor[name].status()`.

---
##### `root`

- `data`: JSON object to serve.

Serves a JSON document at `GET /`.

### Example

A full example of a config file is given below.

Configuration for third party middleware,
[listed in the README](../README.md#middleware),
is passed through unmodified
and is not documented here:
refer to the linked upstream documentation.

These values are not necessarily the defaults.

```json
{
  "port": 80,
  "startupDelay": 1000,
  "shutdownDelay": 1000,
  "shutdownOnChange": false,
  "exitOnUnhandledRejection": true,
  "exitOnFalseStart": true,
  "shutdownTimeout": 10000,
  "log": {
    "level": "info",
    "env": "space",
    "service": "laser",
    "system": "deathstar",
    "base": {"jedi": true},
    "filter": "onlyJedi",
    "outputMode": "pretty"
  },
  "metrics": {
    "prefix": "my_app_",
    "options": {
      "barks_per_puppy": {
        "buckets": [0, 200, 300, 800]
      }
    }
  },
  "koa": {
    "responseTime": {
      "resHeader": "x-response-time"
    },
    "requestId": {
      "reqHeader": "x-request-id",
      "resHeader": "x-request-id",
      "paramName": "reqId",
      "disable": false
    },
    "logger": {
      "useDev": false,
      "addReq": false,
      "level": "debug",
      "reqNameHeader": "x-request-name",
      "disable": false
    },
    "error": {
      "isServerErrorExposed": true,
      "disable": false
    },
    "dependencyInjection": {
      "disable": false
    },
    "helmet": {
      "disable": false
    },
    "cors": {
      "origins": ["localhost", "*.example.com", "example.com"],
      "disable": false
    },
    "conditionalGet": {
      "disable": false
    },
    "etag": {
      "disable": false
    },
    "favicon": {
      "path": "/path/to/favicon.ico",
      "disable": false
    },
    "robots": {
      "rule": "disallow",
      "rules": {
        "disallow": ["User-agent: *", "Disallow: /"]
      },
      "disable": false
    },
    "metrics": {
      "path": "/metrics",
      "disable": false
    },
    "ping": {
      "path": "/ping",
      "isHealthy": true,
      "disable": false
    },
    "ready": {
      "path": "/ready",
      "disable": false
    },
    "health": {
      "path": "/health",
      "disable": false
    },
    "status": {
      "path": "/status",
      "disable": false
    },
    "root": {
      "data": {},
      "disable": false
    }
  }
}
```

[Awilix]: https://github.com/jeffijoe/awilix
[Boom]: https://github.com/hapijs/boom
[confit]: https://github.com/krakenjs/confit
[logger]: https://github.com/meltwater/mlabs-logger
[logger documentation]: https://github.com/meltwater/mlabs-logger/tree/master/docs
[Health Monitor]: https://github.com/meltwater/mlabs-health/tree/master/docs#createhealthmonitortargets-options
[createHealthy]: https://github.com/meltwater/mlabs-health/tree/master/docs#createhealthyoptions
[koa-logger]: https://github.com/koajs/logger
[Prometheus Registry]: https://github.com/siimon/prom-client#multiple-registries
[koa-cors]: https://github.com/koajs/cors
[minimatch]: https://github.com/isaacs/minimatch

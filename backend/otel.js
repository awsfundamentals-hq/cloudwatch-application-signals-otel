const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-grpc');
const { AWSXRayPropagator } = require('@opentelemetry/propagator-aws-xray');
const { AWSXRayIdGenerator } = require('@opentelemetry/id-generator-aws-xray');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { AsyncLocalStorageContextManager } = require('@opentelemetry/context-async-hooks');

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
  textMapPropagator: new AWSXRayPropagator(),
  idGenerator: new AWSXRayIdGenerator(),
  contextManager: new AsyncLocalStorageContextManager(),
});

sdk.start();

const process = require('process');
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(
      () => console.log('SDK shut down successfully'),
      (err) => console.log('Error shutting down SDK', err)
    )
    .finally(() => process.exit(0));
});

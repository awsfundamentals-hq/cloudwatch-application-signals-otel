// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

const createCwAgentConfigSsm = () => {
  const name = `${$app.name}-${$app.stage}`;
  return new aws.ssm.Parameter('cwAgentConfig', {
    name: `/ecs/${name}/cw-agent-config`,
    type: 'String',
    value: `
{
  "traces": {
    "traces_collected": {
      "application_signals": {}
    }
  },
  "logs": {
    "metrics_collected": {
      "application_signals": {}
    }
  }
}
    `,
  });
};

/**
 * Create the necessary roles for ECS: execution role and task role.
 *
 * • ECS Task Execution Role: Allows ECS to manage the task execution.
 * • ECS Task Role: Allows the task to interact with other AWS services.
 */
const createRoles = () => {
  const managedPolicies = {
    taskRole: [
      'CloudWatchFullAccess',
      'AWSXRayDaemonWriteAccess',
      'CloudWatchAgentServerPolicy',
      'AmazonElasticFileSystemClientReadWriteAccess',
    ],
    executionRole: ['service-role/AmazonECSTaskExecutionRolePolicy', 'AmazonSSMFullAccess', 'AmazonElasticFileSystemClientReadWriteAccess'],
  };
  const executionRole = new aws.iam.Role('executionRole', {
    name: `${$app.name}-${$app.stage}-exec`,
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'ecs-tasks.amazonaws.com',
          },
          Action: 'sts:AssumeRole',
        },
      ],
    }),
  });
  for (const [index, policyArn] of managedPolicies.executionRole.entries()) {
    new aws.iam.RolePolicyAttachment(`executionRoleAttachment${index}`, {
      policyArn: $interpolate`arn:aws:iam::aws:policy/${policyArn}`,
      role: executionRole,
    });
  }

  const taskRole = new aws.iam.Role('taskRole', {
    name: `${$app.name}-${$app.stage}-task`,
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'ecs-tasks.amazonaws.com',
          },
          Action: 'sts:AssumeRole',
        },
      ],
    }),
  });
  for (const [index, policyArn] of managedPolicies.taskRole.entries()) {
    new aws.iam.RolePolicyAttachment(`taskRoleAttachment${index}`, {
      policyArn: $interpolate`arn:aws:iam::aws:policy/${policyArn}`,
      role: taskRole,
    });
  }

  return { executionRole: executionRole.name, taskRole: taskRole.name };
};

/**
 * Create a Lambda function with Function URL enabled.
 */
const createLambdaFunction = () => {
  const name = `${$app.name}-${$app.stage}-lambda`;

  const lambdaFunction = new sst.aws.Function('lambdaFunction', {
    name,
    runtime: aws.lambda.Runtime.NodeJS20dX,
    handler: 'lambda/handler.handler',
    policies: [
      'arn:aws:iam::aws:policy/CloudWatchLambdaApplicationSignalsExecutionRolePolicy',
      'arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess',
    ],
    timeout: '30 seconds',
    url: true,
    architecture: 'x86_64',
    environment: {
      AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-handler',
      OTEL_NODE_ENABLED_INSTRUMENTATIONS: 'aws-sdk,aws-lambda,http',
      OTEL_LOG_LEVEL: 'DEBUG',
    },
    layers: [
      // https://aws-otel.github.io/docs/getting-started/lambda/lambda-js
      'arn:aws:lambda:us-east-1:901920570463:layer:aws-otel-nodejs-amd64-ver-1-30-2:1',
    ],
    transform: {
      function: {
        tracingConfig: {
          mode: 'Active',
        },
      },
    },
  });

  return { lambdaFunction };
};

/**
 * Create the ECS cluster and service.
 * This is the ECS service that will run the ECS task.
 */
const createEcsService = (lambda: sst.aws.Function) => {
  const { taskRole, executionRole } = createRoles();
  const cwAgentConfig = createCwAgentConfigSsm();
  const name = `${$app.name}-${$app.stage}`;

  const otelInstrumentationPath = '/otel-auto-instrumentation-node';
  const vpc = new sst.aws.Vpc('vpc');
  const efs = new sst.aws.Efs('efs', { vpc });
  const cluster = new sst.aws.Cluster('cluster', { vpc, transform: { cluster: { name } } });
  const service = new sst.aws.Service('service', {
    transform: { service: { name } },
    cpu: '0.25 vCPU',
    memory: '0.5 GB',
    scaling: { min: 1, max: 1 },
    cluster,
    taskRole,
    executionRole,
    capacity: 'spot',
    serviceRegistry: {
      port: 80,
    },
    containers: [
      {
        name: 'init',
        image: 'public.ecr.aws/aws-observability/adot-autoinstrumentation-node:v0.7.0',
        command: ['cp', '-a', '/autoinstrumentation/.', otelInstrumentationPath],
        volumes: [{ path: otelInstrumentationPath, efs }],
        environment: {
          STAGE: $app.stage,
        },
        logging: {
          retention: '1 week',
          name: `/ecs/${name}/init`,
        },
      },
      {
        name: 'ecs-cwagent',
        image: 'public.ecr.aws/cloudwatch-agent/cloudwatch-agent:latest',
        ssm: {
          CW_CONFIG_CONTENT: cwAgentConfig.arn,
        },
        environment: {
          STAGE: $app.stage,
        },
        logging: {
          retention: '1 week',
          name: `/ecs/${name}/cwagent`,
        },
      },
      {
        name: 'app',
        image: {
          context: './backend',
          dockerfile: 'Dockerfile',
        },
        volumes: [{ path: otelInstrumentationPath, efs }],
        environment: {
          STAGE: $app.stage,
          ECS_CONTAINER_METADATA_URI: 'http://169.254.170.2/v4',
          ECS_ENABLE_CONTAINER_METADATA: 'true',
          OTEL_RESOURCE_ATTRIBUTES: `aws.log.group.names=${name},service.name=${name}`,
          OTEL_LOGS_EXPORTER: 'none',
          OTEL_METRICS_EXPORTER: 'none',
          OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
          OTEL_AWS_APPLICATION_SIGNALS_ENABLED: 'true',
          OTEL_AWS_APPLICATION_SIGNALS_EXPORTER_ENDPOINT: 'http://localhost:4316/v1/metrics',
          OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://localhost:4316/v1/traces',
          OTEL_TRACES_SAMPLER: 'xray',
          OTEL_TRACES_SAMPLER_ARG: 'endpoint=http://localhost:2000',
          NODE_OPTIONS: `--require ${otelInstrumentationPath}/autoinstrumentation.js`,
          LAMBDA_FUNCTION_URL: lambda.url,
          SERVICE_NAME: name,
        },
        logging: {
          retention: '1 week',
          name: `/ecs/${name}/app`,
        },
      },
    ],
  });
  const api = new sst.aws.ApiGatewayV2('api', {
    transform: { api: { name } },
    vpc,
  });
  api.routePrivate('$default', service.nodes.cloudmapService.arn);
  return { apiGateway: api };
};

export default $config({
  app(input) {
    return {
      name: 'ecs-fargate',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      protect: ['production'].includes(input?.stage),
      home: 'aws',
      providers: {
        aws: {
          version: '7.7.0',
          region: 'us-east-1',
        },
      },
    };
  },
  async run() {
    const { lambdaFunction } = createLambdaFunction();
    createEcsService(lambdaFunction);
  },
});

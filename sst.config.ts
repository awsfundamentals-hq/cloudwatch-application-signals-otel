// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

const createCwAgentConfigSsm = () => {
  return new aws.ssm.Parameter('cwAgentConfig', {
    name: '/ecs/awsfundamentals/cw-agent-config',
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
 * Create SNS Topic for SLO Notifications
 * This topic will receive alerts when the SLO is violated.
 */
const createSnsTopicForSlo = () => {
  const topic = new aws.sns.Topic('sloNotificationTopic', {
    name: 'awsfundamentals-slo-notifications',
    displayName: 'AWS Fundamentals SLO Notifications',
  });

  new aws.sns.TopicSubscription('sloEmailSubscription', {
    topic: topic.arn,
    protocol: 'email',
    endpoint: 'schmidt.tobias@outlook.com',
  });

  return topic;
};

/**
 * Create the ECR repository.
 * We expire untagged images so we don't pay for them.
 */
const createRepository = () => {
  const repository = new aws.ecr.Repository('backend', { name: 'awsfundamentals' });

  new aws.ecr.LifecyclePolicy('backendLifecyclePolicy', {
    repository: repository.name,
    policy: JSON.stringify({
      rules: [
        {
          rulePriority: 1,
          description: 'Delete untagged images',
          selection: {
            tagStatus: 'untagged',
            countType: 'imageCountMoreThan',
            countNumber: 1,
          },
          action: {
            type: 'expire',
          },
        },
      ],
    }),
  });

  return repository;
};

/**
 * Create the CloudWatch log groups for ECS tasks.
 *
 * • Backend log group: For the main application container logs
 * • CW-Agent log group: For the CloudWatch agent container logs
 */
const createLogGroups = () => {
  const backendLogGroup = new aws.cloudwatch.LogGroup('logGroupBackend', {
    name: '/ecs/awsfundamentals/backend',
    retentionInDays: 7,
  });

  const cwAgentLogGroup = new aws.cloudwatch.LogGroup('logGroupCwAgent', {
    name: '/ecs/awsfundamentals/cw-agent',
    retentionInDays: 7,
  });

  return { backendLogGroup, cwAgentLogGroup };
};

/**
 * Create the necessary roles for ECS: execution role and task role.
 *
 * • ECS Task Execution Role: Allows ECS to manage the task execution.
 * • ECS Task Role: Allows the task to interact with other AWS services.
 */
const createRoles = () => {
  const executionRole = new aws.iam.Role('executionRole', {
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
  const taskRole = new aws.iam.Role('taskRole', {
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
  new aws.iam.RolePolicyAttachment('executionRoleAttachment', {
    policyArn: 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
    role: executionRole,
  });
  const logPolicy = new aws.iam.Policy('logPolicy', {
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
          Resource: 'arn:aws:logs:*:*:*',
        },
      ],
    }),
  });
  const xrayPolicy = new aws.iam.Policy('xrayPolicy', {
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        { Effect: 'Allow', Action: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords', 'xray:PutServiceMetrics'], Resource: '*' },
      ],
    }),
  });
  const readFromSsmPolicy = new aws.iam.Policy('readFromSsmPolicy', {
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        { Effect: 'Allow', Action: ['ssm:GetParameter'], Resource: '*' },
        { Effect: 'Allow', Action: ['ssm:GetParameters'], Resource: '*' },
      ],
    }),
  });
  new aws.iam.RolePolicyAttachment('taskRoleAttachmentXray', {
    policyArn: xrayPolicy.arn,
    role: taskRole,
  });
  new aws.iam.RolePolicyAttachment('taskRoleAttachmentReadFromSsm', {
    policyArn: readFromSsmPolicy.arn,
    role: executionRole,
  });
  new aws.iam.RolePolicyAttachment('taskRoleAttachment', {
    policyArn: logPolicy.arn,
    role: taskRole,
  });
  new aws.iam.RolePolicyAttachment('taskRoleAttachmentCloudWatchAgent', {
    policyArn: 'arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy',
    role: taskRole,
  });
  return { executionRole, taskRole };
};

/**
 * Create a Lambda function with Function URL enabled.
 */
const createLambdaFunction = () => {
  const name = `${$app.name}-${$app.stage}-awsfundamentals-hello-lambda`;
  const lambdaFunction = new sst.aws.Function('lambdaFunction', {
    name,
    runtime: aws.lambda.Runtime.NodeJS20dX,
    handler: 'lambda/handler.handler',
    role: createLambdaRole(name).arn,
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
 * Create IAM role for Lambda function.
 */
const createLambdaRole = (name: string) => {
  const lambdaRole = new aws.iam.Role('lambdaExecutionRole', {
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'lambda.amazonaws.com',
          },
          Action: 'sts:AssumeRole',
        },
      ],
    }),
  });

  new aws.iam.RolePolicyAttachment('lambdaExecutionRoleAttachment', {
    policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
    role: lambdaRole,
  });

  // Create a log group for the Lambda function
  const logGroup = new aws.cloudwatch.LogGroup('lambdaLogGroup', {
    name: `/aws/lambda/${name}`,
    retentionInDays: 7,
  });

  // Add a policy to allow the Lambda function to write to the log group
  const lambdaLogGroupPolicy = new aws.iam.Policy('lambdaLogGroupPolicy', {
    policy: logGroup.arn.apply((arn) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
            Resource: arn,
          },
        ],
      })
    ),
  });
  new aws.iam.RolePolicyAttachment('lambdaLogGroupPolicyAttachment', {
    policyArn: lambdaLogGroupPolicy.arn,
    role: lambdaRole,
  });

  // Add X-Ray tracing permissions
  new aws.iam.RolePolicyAttachment('lambdaXRayRoleAttachment', {
    policyArn: 'arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess',
    role: lambdaRole,
  });

  // Add OpenTelemetry permissions
  new aws.iam.RolePolicyAttachment('lambdaOpenTelemetryRoleAttachment', {
    policyArn: 'arn:aws:iam::aws:policy/CloudWatchLambdaApplicationSignalsExecutionRolePolicy',
    role: lambdaRole,
  });

  return lambdaRole;
};

/**
 * Create the ECS task definition.
 * This is the configuration for the ECS task that will run the Docker container.
 */
const createTaskDefinition = (params: {
  repositoryUrl: $util.Output<string>;
  taskRole: aws.iam.Role;
  executionRole: aws.iam.Role;
  backendLogGroup: aws.cloudwatch.LogGroup;
  cwAgentLogGroup: aws.cloudwatch.LogGroup;
  lambdaUrl: $util.Output<string> | string;
}) => {
  const cwAgentConfig = createCwAgentConfigSsm();
  const { repositoryUrl, taskRole, executionRole, backendLogGroup, cwAgentLogGroup, lambdaUrl } = params;
  return $util.all([repositoryUrl, cwAgentConfig.name, backendLogGroup.name, cwAgentLogGroup.name, lambdaUrl]).apply(
    ([url, cwAgentConfigName, backendLogGroupName, cwAgentLogGroupName, lambdaFunctionUrl]) =>
      new aws.ecs.TaskDefinition('taskdefinition', {
        requiresCompatibilities: ['FARGATE'],
        family: 'awsfundamentals',
        cpu: '256',
        memory: '512',
        networkMode: 'awsvpc',
        executionRoleArn: executionRole.arn,
        taskRoleArn: taskRole.arn,
        volumes: [{ name: 'opentelemetry-auto-instrumentation-node' }],
        containerDefinitions: JSON.stringify([
          {
            name: 'backend',
            essential: true,
            image: `${url}:latest`,
            portMappings: [
              {
                containerPort: 80,
                hostPort: 80,
                protocol: 'tcp',
                appProtocol: 'http',
              },
            ],
            logConfiguration: {
              logDriver: 'awslogs',
              options: {
                'awslogs-group': backendLogGroupName,
                'awslogs-region': 'us-east-1',
                'awslogs-stream-prefix': 'ecs',
              },
            },
            healthCheck: {
              command: ['CMD-SHELL', 'curl -f http://localhost/ || exit 1'],
              interval: 30,
              timeout: 5,
              retries: 3,
              startPeriod: 0,
            },
            dependsOn: [
              {
                containerName: 'init',
                condition: 'SUCCESS',
              },
            ],
            environment: [
              {
                name: 'ECS_CONTAINER_METADATA_URI',
                value: 'http://169.254.170.2/v4',
              },
              {
                name: 'ECS_ENABLE_CONTAINER_METADATA',
                value: 'true',
              },
              {
                name: 'OTEL_RESOURCE_ATTRIBUTES',
                value: `aws.log.group.names=${backendLogGroupName},service.name=awsfundamentals`,
              },
              {
                name: 'OTEL_LOGS_EXPORTER',
                value: 'none',
              },
              {
                name: 'OTEL_METRICS_EXPORTER',
                value: 'none',
              },
              {
                name: 'OTEL_EXPORTER_OTLP_PROTOCOL',
                value: 'http/protobuf',
              },
              {
                name: 'OTEL_AWS_APPLICATION_SIGNALS_ENABLED',
                value: 'true',
              },
              {
                name: 'OTEL_AWS_APPLICATION_SIGNALS_EXPORTER_ENDPOINT',
                value: 'http://localhost:4316/v1/metrics',
              },
              {
                name: 'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
                value: 'http://localhost:4316/v1/traces',
              },
              {
                name: 'OTEL_TRACES_SAMPLER',
                value: 'xray',
              },
              {
                name: 'OTEL_TRACES_SAMPLER_ARG',
                value: 'endpoint=http://localhost:2000',
              },
              {
                name: 'NODE_OPTIONS',
                value: '--require /otel-auto-instrumentation-node/autoinstrumentation.js',
              },
              {
                name: 'LAMBDA_FUNCTION_URL',
                value: lambdaFunctionUrl,
              },
            ],
            mountPoints: [
              {
                sourceVolume: 'opentelemetry-auto-instrumentation-node',
                containerPath: '/otel-auto-instrumentation-node',
                readOnly: false,
              },
            ],
          },
          {
            name: 'ecs-cwagent',
            image: 'public.ecr.aws/cloudwatch-agent/cloudwatch-agent:latest',
            essential: true,
            secrets: [
              {
                name: 'CW_CONFIG_CONTENT',
                valueFrom: cwAgentConfigName,
              },
            ],
            logConfiguration: {
              logDriver: 'awslogs',
              options: {
                'awslogs-group': cwAgentLogGroupName,
                'awslogs-region': 'us-east-1',
                'awslogs-stream-prefix': 'ecs',
              },
            },
          },
          {
            name: 'init',
            image: 'public.ecr.aws/aws-observability/adot-autoinstrumentation-node:v0.7.0',
            essential: false,
            command: ['cp', '-a', '/autoinstrumentation/.', '/otel-auto-instrumentation-node'],
            mountPoints: [
              {
                sourceVolume: 'opentelemetry-auto-instrumentation-node',
                containerPath: '/otel-auto-instrumentation-node',
                readOnly: false,
              },
            ],
          },
        ]),
      })
  );
};

/**
 * Create the networking resources: VPC, subnets, security group, load balancer, and target group.
 */
const createNetworking = () => {
  const vpc = new aws.ec2.Vpc('vpc', {
    cidrBlock: '172.16.0.0/16',
    tags: { Name: 'awsfundamentals' },
  });
  const subnet1 = new aws.ec2.Subnet('subnet', {
    vpcId: vpc.id,
    cidrBlock: '172.16.1.0/24',
    availabilityZone: 'us-east-1a',
    tags: {
      Name: 'awsfundamentals-us-east-1a',
    },
  });
  const subnet2 = new aws.ec2.Subnet('subnet2', {
    vpcId: vpc.id,
    cidrBlock: '172.16.2.0/24',
    availabilityZone: 'us-east-1b',
    tags: {
      Name: 'awsfundamentals-us-east-1b',
    },
  });
  const internetGateway = new aws.ec2.InternetGateway('internetGateway', {
    vpcId: vpc.id,
  });
  const routeTable = new aws.ec2.RouteTable('routeTable', {
    vpcId: vpc.id,
    routes: [
      {
        cidrBlock: '0.0.0.0/0',
        gatewayId: internetGateway.id,
      },
    ],
  });
  new aws.ec2.RouteTableAssociation('subnet1RouteTableAssociation', {
    subnetId: subnet1.id,
    routeTableId: routeTable.id,
  });
  new aws.ec2.RouteTableAssociation('subnet2RouteTableAssociation', {
    subnetId: subnet2.id,
    routeTableId: routeTable.id,
  });
  const securityGroup = new aws.ec2.SecurityGroup('securityGroup', {
    vpcId: vpc.id,
    ingress: [
      {
        fromPort: 80,
        toPort: 80,
        protocol: 'tcp',
        cidrBlocks: ['0.0.0.0/0'],
      },
      {
        fromPort: 4317,
        toPort: 4317,
        protocol: 'tcp',
        cidrBlocks: ['0.0.0.0/0'],
      },
    ],
    egress: [
      {
        fromPort: 443,
        toPort: 443,
        protocol: 'tcp',
        cidrBlocks: ['0.0.0.0/0'],
      },
      {
        fromPort: 80,
        toPort: 80,
        protocol: 'tcp',
        cidrBlocks: ['0.0.0.0/0'],
      },
      {
        fromPort: 4317,
        toPort: 4317,
        protocol: 'tcp',
        cidrBlocks: ['0.0.0.0/0'],
      },
    ],
    tags: {
      Name: 'awsfundamentals',
    },
  });
  const loadBalancer = new aws.lb.LoadBalancer('loadBalancer', {
    name: 'awsfundamentals',
    internal: false,
    securityGroups: [securityGroup.id],
    subnets: [subnet1.id, subnet2.id],
  });
  const targetGroup = new aws.lb.TargetGroup('targetGroup', {
    name: 'awsfundamentals',
    port: 80,
    protocol: 'HTTP',
    targetType: 'ip',
    vpcId: vpc.id,
    healthCheck: {
      path: '/',
      protocol: 'HTTP',
    },
  });
  new aws.lb.Listener('listener', {
    loadBalancerArn: loadBalancer.arn,
    port: 80,
    protocol: 'HTTP',
    defaultActions: [
      {
        type: 'forward',
        targetGroupArn: targetGroup.arn,
      },
    ],
    tags: {
      Name: 'awsfundamentals',
    },
  });
  return { vpc, subnets: [subnet1, subnet2], securityGroup, targetGroup, loadBalancer };
};
/**
 * Create the ECS cluster and service.
 * This is the ECS service that will run the ECS task.
 */
const createClusterAndService = (params: {
  taskDefinition: $util.Output<aws.ecs.TaskDefinition>;
  securityGroup: aws.ec2.SecurityGroup;
  subnets: aws.ec2.Subnet[];
  targetGroup: aws.lb.TargetGroup;
}) => {
  const { taskDefinition, securityGroup, subnets, targetGroup } = params;
  const { arn: cluster } = new aws.ecs.Cluster('cluster', { name: 'awsfundamentals' });
  new aws.ecs.Service('service', {
    name: 'awsfundamentals',
    cluster,
    desiredCount: 1,
    launchType: 'FARGATE',
    taskDefinition: taskDefinition.arn,
    networkConfiguration: {
      assignPublicIp: true,
      subnets: subnets.map((s) => s.id),
      securityGroups: [securityGroup.id],
    },
    loadBalancers: [
      {
        targetGroupArn: targetGroup.arn,
        containerName: 'backend',
        containerPort: 80,
      },
    ],
  });
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
    const { repositoryUrl } = createRepository();

    const { backendLogGroup, cwAgentLogGroup } = createLogGroups();

    const { executionRole, taskRole } = createRoles();

    const { lambdaFunction } = createLambdaFunction();

    const taskDefinition = createTaskDefinition({
      repositoryUrl,
      taskRole,
      executionRole,
      backendLogGroup,
      cwAgentLogGroup,
      lambdaUrl: lambdaFunction.url,
    });

    const { subnets, securityGroup, targetGroup, loadBalancer } = createNetworking();

    createClusterAndService({ taskDefinition, securityGroup, subnets, targetGroup });

    // SLO can't be created via Pulumi yet as it's not supported yet
    createSnsTopicForSlo();

    loadBalancer.dnsName.apply((dnsName) => console.info(`🪄 LoadBalancer Endpoint: http://${dnsName}`));
    lambdaFunction.url.apply((url) => console.info(`🪄 Lambda Function URL: ${url}`));
  },
});

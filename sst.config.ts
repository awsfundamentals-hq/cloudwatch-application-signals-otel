// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'ecs-fargate',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      protect: ['production'].includes(input?.stage),
      home: 'aws',
    };
  },
  async run() {
    const repository = new aws.ecr.Repository('backend', { name: 'awsfundamentals' });
    const cluster = new aws.ecs.Cluster('cluster', { name: 'awsfundamentals' });
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
    new aws.cloudwatch.LogGroup('logGroup', {
      name: '/ecs/awsfundamentals',
      retentionInDays: 7,
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
    new aws.iam.RolePolicyAttachment('taskRoleAttachment', {
      policyArn: logPolicy.arn,
      role: taskRole,
    });
    const taskDefinition = repository.repositoryUrl.apply(
      (url) =>
        new aws.ecs.TaskDefinition('taskdefinition', {
          requiresCompatibilities: ['FARGATE'],
          family: 'awsfundamentals',
          cpu: '256',
          memory: '1024',
          networkMode: 'awsvpc',
          executionRoleArn: executionRole.arn,
          taskRoleArn: taskRole.arn,
          containerDefinitions: JSON.stringify([
            {
              name: 'backend',
              essential: true,
              image: `${url}:latest`,
              memory: 1024,
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
                  'awslogs-group': '/ecs/awsfundamentals',
                  'awslogs-region': 'us-east-1',
                  'awslogs-stream-prefix': 'ecs',
                },
              },
            },
          ]),
        })
    );
    const vpc = new aws.ec2.Vpc('vpc', {
      cidrBlock: '172.16.0.0/16',
    });
    const subnet1 = new aws.ec2.Subnet('subnet', {
      vpcId: vpc.id,
      cidrBlock: '172.16.1.0/24',
      availabilityZone: 'us-east-1a',
    });
    const subnet2 = new aws.ec2.Subnet('subnet2', {
      vpcId: vpc.id,
      cidrBlock: '172.16.2.0/24',
      availabilityZone: 'us-east-1b',
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
      ],
    });
    const loadBalancer = new aws.lb.LoadBalancer('loadBalancer', {
      internal: false,
      securityGroups: [securityGroup.id],
      subnets: [subnet1.id, subnet2.id],
    });
    const targetGroup = new aws.lb.TargetGroup('targetGroup', {
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
    });
    new aws.ecs.Service('service', {
      cluster: cluster.arn,
      desiredCount: 1,
      launchType: 'FARGATE',
      taskDefinition: taskDefinition.arn,
      networkConfiguration: {
        assignPublicIp: true,
        subnets: [subnet1.id, subnet2.id],
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

    new sst.aws.Nextjs('frontend');
  },
});

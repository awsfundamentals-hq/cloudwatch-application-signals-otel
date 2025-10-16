export interface ECSContainer {
  DockerId: string;
  Name: string;
  DockerName: string;
  Image: string;
  ImageID: string;
  Labels: {
    'com.amazonaws.ecs.cluster': string;
    'com.amazonaws.ecs.container-name': string;
    'com.amazonaws.ecs.task-arn': string;
    'com.amazonaws.ecs.task-definition-family': string;
    'com.amazonaws.ecs.task-definition-version': string;
    [key: string]: string;
  };
  DesiredStatus: string;
  KnownStatus: string;
  Limits: {
    CPU: number;
    Memory?: number;
  };
  CreatedAt: string;
  StartedAt: string;
  Type: string;
  Health?: {
    status: string;
    statusSince: string;
    output?: string;
  };
  LogDriver: string;
  LogOptions: {
    'awslogs-group': string;
    'awslogs-region': string;
    'awslogs-stream': string;
    mode: string;
  };
  ContainerARN: string;
  Networks: Array<{
    NetworkMode: string;
    IPv4Addresses: string[];
    AttachmentIndex: number;
    MACAddress: string;
    IPv4SubnetCIDRBlock: string;
    DomainNameServers: string[];
    DomainNameSearchList: string[];
    PrivateDNSName: string;
    SubnetGatewayIpv4Address: string;
  }>;
  Snapshotter: string;
}

export interface ECSTaskMetadata {
  Cluster: string;
  TaskARN: string;
  Family: string;
  Revision: string;
  DesiredStatus: string;
  KnownStatus: string;
  Limits: {
    CPU: number;
    Memory: number;
  };
  PullStartedAt: string;
  PullStoppedAt: string;
  AvailabilityZone: string;
  LaunchType: string;
  Containers: ECSContainer[];
  ServiceName?: string;
  ClockDrift?: {
    ClockErrorBound: number;
    ReferenceTimestamp: string;
    ClockSynchronizationStatus: string;
  };
  EphemeralStorageMetrics?: {
    Utilized: number;
    Reserved: number;
  };
  FaultInjectionEnabled?: boolean;
}

export interface ContainerMetadata {
  startTime: string; // ISO string format
  taskDefinitionVersion: string;
  containerName: string;
  taskArn: string;
  cluster: string;
}
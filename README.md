# CloudWatch Application Signals via OpenTelemetry on Fargate and Lambda 

This project demonstrates how to run two simple Node.js apps using [Fargate](https://docs.aws.amazon.com/AmazonECS/latest/userguide/what-is-fargate.html) via ECS and [AWS Lambda](https://docs.aws.amazon.com/lambda/) with [SST](https://sst.dev) v3 to showcase [CloudWatch's Application Signals](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Application-Monitoring-Sections.html).

## Getting Started

To run this application, follow these steps:

1. Ensure you have Node.js installed on your system.
2. Clone this repository to your local machine.
3. Install the dependencies by running `pnpm i` in the project root directory.
4. Provision the infrastructure via `pnpm run sst:deploy:dev`.
5. Invoke either ECS or Lambda via the provided NX commands, e.g. `INVOKE_PATH=/lambda npx nx run invoke:ecs:dev`
6. Open the CloudWatch console to explore your Application Map!

## Important: Cost Considerations

⚠️ **Warning:** This project spins up Fargate tasks that remain running and will incur ongoing costs (approximately $7-$10 per month, not including CloudWatch charges).

To avoid unexpected charges, remove all resources when done by running:
```bash
pnpm run sst:remove:dev
```

## Learn More

For more AWS fundamentals content and resources:
- Visit our blog at [awsfundamentals.com/blog](https://awsfundamentals.com/blog)
- Check out our other projects on GitHub at [awsfundamentals-hq](https://github.com/awsfundamentals-hq)

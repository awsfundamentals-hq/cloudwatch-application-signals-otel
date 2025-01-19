# Simple Node.js App with Fargate via ECS using SST v3

![Architecture Diagram](/public/architecture.png)

This project demonstrates how to run a simple Node.js app using Fargate via ECS (Elastic Container Service) with SST (Serverless Stack) v3.

## Getting Started

To run this application, follow these steps:

1. Ensure you have Node.js installed on your system.
2. Clone this repository to your local machine.
3. Install the dependencies by running `npm install` in the project root directory.
4. Provision the infrastructure via `npx sst dev`.
5. Build and push the Docker image by running `npm run docker:build`.
6. Access your application via `http://localhost:3000`.

## About the Project

This application is a simple Node.js app that runs in a Docker container, deployed to Fargate via ECS using SST v3 for infrastructure provisioning.

## Project Structure

- `app.js`: Main application file
- `Dockerfile`: Docker configuration file
- `package.json`: Node.js package configuration
- `sst.config.ts`: SST configuration file

## Learn More

To learn more about Fargate, ECS, and SST, check out the [AWS documentation](https://aws.amazon.com/ecs/) and [SST documentation](https://docs.sst.dev/).

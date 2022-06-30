## Types

There are 3 types of deployment types for SearchNEU and the course-catalog API.

1. Frontend-only: see the [documentation on the SearchNEU repo](https://github.com/sandboxnu/searchneu)
2. Backend-only: See below. In short, you just need to create a new Docker image, push it to AWS, and run it in an AWS Elastic Container Service (ECS)
3. Backend infrastructure changes: See below. In short - Terraform.

## Deploying CCA changes

- Run `./infrastructure/aws/push-image`
  - This pushes a new Docker image to AWS ECR with the `staging` tag
- Run `./infrastructure/aws/redeploy staging`
  - This redeploys the staging CCA with the latest Docker image tagged with `staging`
- Ensure that the staging API looks and operates as expected
- Run `./infrastructure/aws/redeploy prod`
  - This tags the latest `staging` Docker image with a `prod` tag and redeploys prod CCA using that image

## Terraform deployment

Anytime you have an infrastructure change (as opposed to a code change), we need a Terraform deployment.

Examples of infrastructure changes include: new server, additional ECS task, different health check path for a target group, etc. While infrastructure changes _can_ be done manually on the AWS console, you should always update the terraform modules (the`.tf` files) so they reflect the state of the desired infrastructure setup. The idea of Terraform is "infrastructure as code", so if we ever need to set up infrastructure from scratch again, Terraform can do that for us instead of someone having to remember all the steps and manually set everything up. If you make changes to any `.tf` files, you'll most likely need to run Terraform to push these infrastructure changes to AWS.

Terraform stages plans when course-catalog-api has changes in `master`. These Terraform plans describe the infrastructure changes Terraform would apply if someone were to run the plan. Plans are _not_ automatically run when changes in `master` are pushed; plans are only created. To run a plan, someone needs to go to the course-catalog-api workspace (currently, it's named `course-catalog-api-2`) -> Runs -> and manually confirm a planned run. Alternatively, to force a new run without having to push to `master`, you can trigger a manual run on the [Terraform UI](https://app.terraform.io/app/sandboxnu/workspaces/course-catalog-api-2) by clicking on Actions -> Start new plan.

Terraform should also be used when there are new environment variables for the backend (e.g. Twilio credentials). These variables are set manually by going to the course-catalog-api workspace -> Variables. See the `infrastructure/migration` documentation for an explanation of what some of the existing variables are used for and how to add new variables.

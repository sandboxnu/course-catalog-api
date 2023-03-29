## Types

There are 3 types of deployment types for SearchNEU and the course-catalog API.

1. Frontend-only: see the [documentation on the SearchNEU repo](https://github.com/sandboxnu/searchneu)
2. Backend code-changes: This is the most common type of backend deploy

- Essentially, this creates a new Docker image, pushes it to AWS, and runs it in an AWS Elastic Container Service (ECS)

3. Backend infrastructure changes: this is only necessary if we change the infrastructure setup

- eg. creating/modifying DNS or certificates, changing how much memory our services have, upgrading the PSQL version, etc.

## Backend Code Deployment

### Prerequisites

- [Admin] Create an AWS account for the user.
  - Ensure that _"Enable console access"_ is checked
  - Assign the user to the **SearchNeuDev** group
- [User] Log into the new account and change your password
- Create an [access key ID and secret access key](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html#cli-configure-quickstart-creds-create)
- Run [`aws configure`](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html) in your local terminal. Provide the newly-created access information.
  - The other prompts should be left as the defaults

### Steps

- Run `./infrastructure/aws/push-image`

This runs `docker build` in your local environment, tags the resulting image, and pushes it up to AWS ECR (a registry for Docker images). This also tags the Docker image with the `staging` tag.

We maintain two clusters (ie. groups) of ECS (Elastic Container Service) containers running in AWS — a staging group, and a production group. Whenever the staging group is restarted, it will use the Docker image with the `staging` tag as its source. However, instead of waiting for the staging group to redeploy itself (which would only happen when the container runs into an error and dies), we forcibly restart it in the next step.

?> Occasionally, you may run into deployment issues where the image deployed to AWS doesn't accuratly reflect the state it should. The cause is currently unknown, but it's suspected to be a Docker caching issue. Try using `docker prune` to remove your current images and caches.<br/><br/>2023-02-13: @sebwittr is investigating.

- Run `./infrastructure/aws/redeploy staging`

This re-deploys the staging group in AWS, which will now use the latest Docker image tagged with `staging` (ie. the one you just built and pushed up to AWS)

- Ensure that the staging API looks and operates as expected

- Run `./infrastructure/aws/redeploy prod`

This tags the latest `staging` Docker image with a `prod` tag and redeploys the production group using that image.

## Backend Infrastructure Deployment

Anytime you have an infrastructure change (as opposed to a code change), we need a Terraform deployment.

Examples of infrastructure changes include: new server, additional ECS task, different health check path for a target group, etc. While infrastructure changes _can_ be done manually on the AWS console, you should always update the terraform modules (the`.tf` files) so they reflect the state of the desired infrastructure setup. The idea of Terraform is "infrastructure as code", so if we ever need to set up infrastructure from scratch again, Terraform can do that for us instead of someone having to remember all the steps and manually set everything up. If you make changes to any `.tf` files, you'll most likely need to run Terraform to push these infrastructure changes to AWS.

Terraform stages plans when course-catalog-api has changes in `master`. These Terraform plans describe the infrastructure changes Terraform would apply if someone were to run the plan. Plans are _not_ automatically run when changes in `master` are pushed; plans are only created. To run a plan, someone needs to go to the course-catalog-api workspace (currently, it's named `course-catalog-api-2`) -> Runs -> and manually confirm a planned run. Alternatively, to force a new run without having to push to `master`, you can trigger a manual run on the [Terraform UI](https://app.terraform.io/app/sandboxnu/workspaces/course-catalog-api-2) by clicking on Actions -> Start new plan.

Terraform should also be used when there are new environment variables for the backend (e.g. Twilio credentials). These variables are set manually by going to the course-catalog-api workspace -> Variables. See the `infrastructure/migration` documentation for an explanation of what some of the existing variables are used for and how to add new variables.

### Deployment

There are 3 kinds of deployments for SearchNEU/Course-Catalog-API.

1. Frontend only changes - see [docs/Deployment.md on the SearchNEU repo](https://github.com/sandboxnu/searchneu/pull/138/files#diff-e622cf45c9d4e0437231d2c9d263fcc5dc570d5efa5f46a9f919c73c109dea3dR1-R5)

2. Backend code changes only - see below — essentially, you just need to push a new Docker image and run it in AWS Elastic Container Service (ECS)

3. Backend infrastructure changes - see below — basically, Terraform

#### Q: How do I deploy CCA code changes to staging or prod?

- Run `./infrastructure/aws/push-image` in `course-catalog-api` to push a new Docker image to AWS ECR with the `staging` tag
- Run `./infrastructure/aws/redeploy staging` in `course-catalog-api` to redeploy staging CCA with the latest Docker image tagged with `staging`
- Run `./infrastructure/aws/redeploy prod` in `course-catalog-api` to tag the latest `staging` Docker image with a `prod` tag and redeploy prod CCA using that image

#### Q: When do I need to use Terraform for deployment?

Anytime you have an infrastructure change (as opposed to a code change). Examples of infrastructure changes include: new server, additional ECS task, different health check path for a target group, etc. While infrastructure changes _can_ be done manually on the AWS console, you should always update the terraform modules (the`.tf` files) so they reflect the state of the desired infrastructure setup. The idea of Terraform is "infrastructure as code", so if we ever need to set up infrastructure from scratch again, Terraform can do that for us instead of someone having to remember all the steps and manually set everything up. If you make changes to any `.tf` files, you'll most likely need to run Terraform to push these infrastructure changes to AWS.

#### Q: How does Terraform deployment work?

Terraform stages plans when course-catalog-api has changes in `master`. These Terraform plans describe the infrastructure changes Terraform would apply if someone were to run the plan. Plans are _not_ automatically run when changes in `master` are pushed; plans are only created. To run a plan, someone needs to go to the course-catalog-api workspace (currently, it's named `course-catalog-api-2`) -> Runs -> and manually confirm a planned run. Alternatively, to force a new run without having to push to `master`, you can trigger a manual run on the [Terraform UI](https://app.terraform.io/app/sandboxnu/workspaces/course-catalog-api-2) by clicking on Actions -> Start new plan.

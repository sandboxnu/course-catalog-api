# Overview

This document covers how we migrate infrastructure.

For this document, "migration" is the process of migrating our backend infrastructure from its current AWS account to a new one.

We need to run this migration process for several reasons:

- Keep the account in the hands of an active member
  - SearchNEU has inherent turnover as members graduate, and we want to make sure that the owner of the infrastructure is a current member
- Our account runs out of AWS credits

## Create a new AWS account, and apply for AWS credits

!> In the past, when we received new credits for our project, they had to be applied to a new account. **This may no longer be the case**; the AWS credit-approval process changes frequently. Before starting this process, talk to a member of eboard for a more up-to-date summary.

Create a new AWS account using someone's Northeastern email.

Next, then follow these steps for AWS Activate:

1.  Visit the AWS Activate webpage https://aws.amazon.com/activate/portfolio-signup to apply.
2.  Ask someone on the Sandbox E-Board for the Organization ID (case-sensitive) on your application form. (Note: This is not a promotional code that can be used in your Billing Console)
3.  Provide your AWS Account ID on the application. AWS Activate Credits will be added directly to this account, so please double check it - we cannot transfer credits in the future.
4.  Please provide your startup company name and email address associated with your AWS Account ID.
5.  Email aws@sandboxnu.com with an email including the project name and some basic details. This is an unofficial step but will let Sandbox know that we can "OK" the credit package.
6.  The Sandbox exec director has to approve the request for AWS credits so if it's been a few days, just message them to get it approved! You can check whether or not you received the credits by going to `Billing > Credits`.

## Optional setup steps

?> If you created a new AWS account, these are admin setup steps that aren't required but are **good to do**

- Go to Billing Preferences and check `Receive Billing Alerts` and `Receive Free Tier Usage Alerts`
- Create a billing alarm (set thresholds you're comfortable with) so you can get notified if you're getting charged more than you expect
  - You'll probably have to create an SNS (Simple Notification Service) subscription for yourself and take a couple steps to confirm the subscription
- Create administrator IAM role for yourself https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started_create-admin-group.html
- Follow this AWS tutorial to create policies for billing full access and billing view access - you'll probably want to give your administrator IAM user (aka yourself) billing full access. That way you won't really have to log in as a root user in the future. https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_billing.html
- Create new user groups and users and assign the users to user groups as needed for other SearchNEU members. Most of them probably only need read/write access to a few services. If anyone's curious about billing, you can also give them billing view access.

## Getting the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

#### Requirements:

- An AWS account
- Admin access to the `course-catalog-api` repository in Github

#### Overview:

Terraform needs access to an AWS user on your account in order to apply infrastructure changes. This step will create that user and save its credentials.

1. Go to `IAM` in AWS, and create a new user.
   - The user's credential type should be `Programmatic Access`
     - This grants us an access key ID and a secret access key for the AWS API
   - Initially, assign the user full permissions (`Administrator`)
     - Rather than initially configure permissions, we will first apply the Terraform plan, and then check which resources the user actually accesses. We can then update the user permissions with a more restrictive role.
     - Why? AWS permission types and naming can change over time, so this process is more flexible than a static list of permissions to enable.
2. Click on the new user, go to `Security credentials`, and create an access key.
   - Save the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` somewhere securely - we'll need them both later.
3. In Github, go to the `course-catalog-api` repo's settings, and go to `Secrets > Actions`
   - Replace the existing `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` repository secrets with the new values.
     - Note: these are not currently used. In the future, we plan to use Github Actions to push new Docker images to AWS ECR, and deploy those images to the staging environment whenever new commits are pushed to the `master` branch.

## Setting up the new Terraform workspace

!> **GOTCHA**: You can't just replace the existing `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in Terraform because Terraform maintains some internal state with each applied run, so it'll still think you're trying to apply infrastructure changes to the old account (and fail because the new AWS access keys are for the new account). This means you either have to manually destroy the Terraform plan - not the best option - or create a new Terraform workspace - the better option.

#### Requirements:

- A new AWS account
- Access to the old SearchNEU AWS account
  - Access to `Parameter Store`
- Access to our Terraform account
- Access to our Cloudflare account

1.  Create a new Terraform workspace.
    - Type: Version control workflow
    - Version control provider: GitHub
    - Set the Terraform Working Directory to `infrastructure/terraform/`
    - For the Version Control settings, set `Automatic Run Triggering` to `Always trigger runs`.
    - Turn on the `Automatic speculative plans` toggle
2.  Set up the variables
    - Terraform variables
      - `sensitive`: Generate a new SSH keypair. Save the public key value for `ssh_public_key`: this is used to SSH into the jumphost
      - `sensitive`: `prod_secrets` and `staging_secrets` contain _most_ of the prod secrets and staging secrets, respectively, in the AWS Parameter Store in HCL (HashiCorp Configuration Language) which looks like:
      ```
      [
         {
               name = "secret1",
               value = "blah",
               description = "My secret 1",
         },
         {
               name = "secret2",
               value = "blahblahblah",
               description = "My secret 2",
         },
      ]
      ```
          - The secrets can be found in the AWS Parameter Store of the **current** SearchNEU AWS account
             - **Do not add all of the secrets!**: the prod / staging secrets in the AWS Parameter Store that should NOT go in Terraform variables are the ones declared [here](https://github.com/sandboxnu/course-catalog-api/blob/master/infrastructure/terraform/modules/course-catalog-api/ecs.tf#L184-L194) (currently `elasticURL` and `DATABASE_URL` since their values are determined by AWS).
             - In `ecs.tf`, you'll see some of the logic for generating secrets
      - `cloudflare_zone_id` - open Cloudflare, and go to the `Overview` page. In the `API` section, find the `Zone ID` value.
      - `aws_certificate_arn`
      - `aws_region` - set to `us-east-1` (or whatever your primary AWS region is)
    - Environment Variables
      - `sensitive`: `GITHUB_TOKEN` is a GitHub personal access token you have to generate. [Instructions here](https://docs.github.com/en/github/authenticating-to-github/keeping-your-account-and-data-secure/creating-a-personal-access-token)
      - `sensitive`: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are the same values as in GitHub
      - `sensitive`: `CLOUDFLARE_EMAIL` is the email of someone with access to CloudFlare
      - `sensitive`: `CLOUDFLARE_API_KEY` can be accessed by logging into CloudFlare using the email provided for `CLOUDFLARE_EMAIL`, go to `My Profile` > `API Tokens` > view the `Global API Key`
      - `TF_LOG` should be set to the value `TRACE`
        - This enables debug-level logging for Terraform runs. We'll use the output of these logs in a later step to create a more strict permissions-setting for our AWS IAM user.
3.  Set the Terraform version
    - In `Settings > General > Terraform Version`, set the version to the one specified in `providers.tf`

## Create a temporary front-end redirect

The migration will necessarily have some downtime, as our API wil be inaccessible. We want to let our users know. Following [this PR](https://github.com/sandboxnu/searchneu/pull/193), redirect all pages to the `/down` page.

## CloudFlare

!> **After this step, SearchNEU and GraduateNU will be non-functional.** Ensure that both project teams and their users are prepared for this.

1. Go to CloudFlare -> DNS and delete the records for `api` and the corresponding record for staging CCA (currently, `stagingapi`).
   - These will get recreated with new content once you run Terraform again.

## Creating the New Infrastructure

!> Warning: this process is ugly and error-prone, you'll likely run into unexplainable failures and have to run things multiple times. It's okay. Here are some of the steps to take, errors we've run into, and ways we've handled them.

1. Trigger a run from Terraform. Some common failures (and solutions) are listed below.
   - Elasticsearch Domain: Creating the Elasticsearch domain might fail the first time (see [this comment](https://github.com/sandboxnu/course-catalog-api/blob/master/infrastructure/terraform/modules/course-catalog-api/elasticsearch.tf#L20)).
   - Elasticsearch Domain: Creating the Elasticsearch domain can take **over 40 minutes**.
     - If you want to see the actual status of the Elasticsearch domain (ie. what part of the setup process it's currently on), open the AWS Elasticsearch page in your browser.
   - Cloudflare cert: `attempted to override existing record however didn't find an exact match`
     - When requesting an HTTPS certificate from AWS, they need to erify our ownership of the DNS. To do so, we need to create DNS CNAME records in Cloudflare.
     - If you get this error, try manually deleting all old AWS certificate DNS records in Cloudflare and re-running the plan.
       - The name is typically an alphanumeric string starting with an underscore (eg. `_a08bda128f1298acc`), and the value is also an underscore-prefixed alphanumeric string which ends with `acm-validations.aws`.
2. On your machine, open a terminal and run `aws configure` to update your AWS CLI credentials. You'll get prompted for your access key ID and secret access key; fill them in with the appropriate values. Then you'll need to run the `push-image` and `redeploy` script in `./infrastructure/aws` to push new Docker images to the AWS ECR.
3. If the scrapers are broken, follow the instructions in `documentation/production_scrape.md` to import a scrape into prod.

!> Don't forget to update the AWS user's permissions! After applying a Terraform plan, look at the logs and search for "DEBUG: Request". This will show you a list of all AWS actions used. Note that the names might not _exactly_ line up with the naming scheme used in AWS, but this can be easily Googled.

## Make Sure Graduate Isn't Broken

Graduate is a Sandbox project which relies on our API.

1. Migrate major data into the production database so Graduate doesn't break. Ask someone on the Graduate team for an up-to-date `majors.json` file, put that inside the `./data` directory, and run the `migrate_major_data` script inside `./scripts` by running `DATABASE_URL=<PROD DATABASE URL> yarn babel-node-ts scripts/migrate_major_data.ts`.

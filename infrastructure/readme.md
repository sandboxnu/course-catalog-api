# All About Infrastructure

### Migrating Infrastructure To New AWS Account

Until we have a better system, the SearchNEU team will have to periodically migrate the infrastructure to a new AWS account when the old one runs out of AWS credits. Here are the things you'll need to do:

##### Create a new AWS and apply for AWS credits

1. Create a new AWS account using someone's northeastern email.

Follow these steps for AWS Activate (per project):

1.  Visit the AWS Activate webpage https://aws.amazon.com/activate/portfolio-signup to apply.
2.  Ask someone on the Sandbox E-Board for the Organization ID (case-sensitive) on your application form. (Note: This is not a promotional code that can be used in your Billing Console)
3.  Provide your AWS Account ID on the application. AWS Activate Credits will be added directly to this account, so please double check it - we cannot transfer credits in the future.
4.  Please provide your startup company name and email address associated with your AWS Account ID.
5.  Email aws@sandboxnu.com with an email including the project name and some basic details. This is an unofficial step but will let Sandbox know that we can "OK" the credit package.
6.  The Sandbox exec director has to approve the request for AWS credits so if it's been a few days, just message them to get it approved! You can check whether or not you received the credits by going to Billing > Credits.

##### Some other admin setup steps that aren't required but probably good to do

- Go to Billing Preferences and check `Receive Billing Alerts` and `Receive Free Tier Usage Alerts` cuz you probably want those alerts
- Create a billing alarm (set thresholds you're comfortable with) so you can get notified if you're getting charged more than you expect
  - You'll probably have to create an SNS (Simple Notification Service) subscription for yourself and take a couple steps to confirm the subscription
- Create administrator IAM role for yourself https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started_create-admin-group.html
- Follow this AWS tutorial to create policies for billing full access and billing view access - you'll probably want to give your administrator IAM user (aka yourself) billing full access. That way you won't really have to log in as a root user in the future. https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_billing.html
- Create new user groups and users and assign the users to user groups as needed for other SearchNEU members. Most of them probably only need read/write access to a few services. If anyone's curious about billing, you can also give them billing view access.

##### Getting the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

1. Create a new IAM role, assign it to the user group with the necessary read/write access and give it `Programmatic Access`.
2. Click on this role and click `Create access key`. Download the generated file and save it somewhere.
3. Replace the existing `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` values with the new ones in GitHub.
   - Once we get the GitHub actions set up, Github will need the two keys to push new Docker images to AWS ECR and tell staging to point to it.

#### CloudFlare

1. Go to CloudFlare -> DNS and delete the records for `api` and the corresponding record for staging CCA. These will get recreated with new content once you run Terraform again.

#### Setting up the new Terraform workspace

**GOTCHA**: You can't just replace the existing `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in Terraform because Terraform maintains some internal state with each applied run, so it'll still think you're trying to apply infrastructure changes to the old account (and fail because the new AWS access keys are for the new account). This means you either have to manually destroy the Terraform plan - not the best option - or create a new Terraform workspace - the better option.

1. Create a new Terraform workspace.
   - Type: Version control workflow
   - Version control provider: GitHub
   - Set the Terraform Working Directory to `infrastructure/terraform/`
   - Set the Terraform version to the version specified in `providers.tf`
   - For the Version Control settings, set Automatic Run Triggering to `Always trigger runs`. Turn on the Automatic speculative plans toggle to on
2. Set up the Terraform variables
   Terraform Variables
   - Generate a new SSH key for `ssh_public_key`: this is used to SSH into the jumphost
   - `prod_secrets` contains _most_ of the prod secrets in the AWS Parameter Store in HCL (HashiCorp Configuration Language) which looks something like:
     ```
     [
        {
            name = "secret1"
            value = "blah"
            description = "My secret 1"
        },
        {
            name = "secret2"
            value = "blahblahblah"
            description = "My secret 2"
        },
     ]
     ```
     - The prod secrets in the AWS Parameter Store that should NOT go in Terraform variables are the ones that have a corresponding value for staging.
     - In `ecs.tf`, you'll see some of the logic for generating secrets
       Environment Variables
   - `GITHUB_TOKEN` is a GitHub personal access token you have to generate. [Instructions here](https://docs.github.com/en/github/authenticating-to-github/keeping-your-account-and-data-secure/creating-a-personal-access-token)
   - `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are the same values as in GitHub
   - `CLOUDFLARE_EMAIL` is the email of someone with access to CloudFlare
   - `CLOUDFLARE_API_KEY` can be accessed by logging into CloudFlare using the email provided for `CLOUDFLARE_EMAIL`, go to `My Profile` > `API Tokens` > view the `Global API Key`
3. Trigger a run from Terraform. Creating the elasticsearch domain might take up to 40 minutes.
4. If this hasn't been configured in Terraform, go to EC2 -> Target Groups (under Load Balancers) and change the health check path for both staging and prod to `/.well-known/apollo/server-health`. This is the status check path for the Apollo GraphQL server. The default path of `/` won't work and will cause all the ECS tasks to get killed because the load balancer thinks they're unhealthy.
5. On your machine, open a terminal and run `aws configure` to update your AWS CLI credentials. You'll get prompted for your access key ID and secret access key; fill them in with the appropriate values. Then you'll need to run the `push-image` and `redeploy` script in `./infrastructure/aws` to push new Docker images to the AWS ECR.

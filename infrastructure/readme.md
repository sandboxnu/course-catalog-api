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
2. Click on this role and click `Create access key`. Download the generated file and save it somwhere.
3. Replace the existing `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` values with the new ones in both GitHub and Terraform.
   - Once we get the GitHub actions set up, Github will need the two keys to push new Docker images to AWS ECR and tell staging to point to it.

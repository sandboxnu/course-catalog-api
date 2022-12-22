## Changing the Staging URL

This isn't something that needs to happen often, but we have had to change our staging URL before from `staging.api.searchneu.com` to `stagingapi.searchneu.com` because our SSL certificate only covered one wildcard subdomain.

1. In `staging.tf`, change `domains` to the desired name.
2. Apply and run Terraform with this change. At this point, the AWS load balancer should have a rule for the new domain, something like `IF Host is stagingapi.searchneu.com THEN forward to somewhere`. CloudFlare should also have a new CNAME record for this new domain.
3. However, if you visit the new domain, you'll probably get a 526 Invalid SSL Certificate error. This is because you need a new certificate in AWS ACM that covers this new domain.
4. To set up this new certificate, go to AWS ACM and request a new public certificate. Fill in the appropriate domain names and choose `DNS validation`.
5. The certificate status will say `Pending validation` until you add the given CNAME record(s) to CloudFlare with proxy status `DNS only`.
6. Finally, to put this certificate to use, go to the AWS load balancer -> Listeners -> select the listener with an SSL certificate -> Edit and change the default SSL certificate to the newly created one.

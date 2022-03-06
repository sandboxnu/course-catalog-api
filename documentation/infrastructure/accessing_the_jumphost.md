# How to access the Jumphost

1. Generate an SSH key pair on your machine.
2. Give someone with prod access your public SSH key and have them follow [these instructions](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html) to add new SSH key to the Jumphost - see the section on `Add or replace a key pair for your instance`. Basically, add the new public SSH key to `.ssh/authorized_keys` on the jumphost.
3. On your machine, run `ssh -i <PATH TO SSH PRIVATE KEY> <USER>@<JUMPHOST IP ADDRESS>`. Someone on the team can probably tell you what `USER` and the Jumphost IP address are.

## Optional

It can get annoying to have to keep typing out the user and remembering the Jumphost IP address. You can avoid this by setting up an SSH config file. The following instructions are for Mac and Linux users but there is probably an equivalent for Windows.

1. Create a file called `config` in `~/.ssh`.
2. Add these lines to `config`

```
Host <WHATEVER HOSTNAME YOU WANT>
  HostName <JUMPHOST IP ADDRESS>
  User <USER>
  IdentityFile <PATH TO SSH PRIVATE KEY>
```

3. Now you can ssh into the Jumphost by running `ssh <WHATEVER HOSTNAME YOU WANT>`.

# Prerequisites/Dependencies

This setup guide tries its best not to assume people have background knowledge, and provides basic setup instructions.

### Terminal

To work on this project, you\'ll need a UNIX-based terminal. Mac/Linux users already have this. Windows users should install WSL, the Windows Subsystem for Linux.

[WSL installation instructions](https://docs.microsoft.com/en-us/windows/wsl/install-win10). Also make sure to [upgrade to version 2](https://docs.microsoft.com/en-us/windows/wsl/install#upgrade-version-from-wsl-1-to-wsl-2).

?> **Tip:** We recommend installing [Windows Terminal](https://docs.microsoft.com/en-us/windows/terminal/install) for a better development experience than the Command Prompt.

### Docker Desktop

- Install [Docker Desktop](https://docs.docker.com/desktop)
- Ensure that `docker-compose` was installed - run `docker-compose --help` in your terminal to check
  - If using Windows, ensure that WSL2 integration is enabled ([WSL integration](https://docs.docker.com/desktop/windows/wsl/))

### Fast Node Manager (fnm)

- Install [FNM](https://github.com/Schniz/fnm) - this helps manage Node versions
  - Don't install anything else yet - we'll do that in a bit

### Source code

- Clone the repo: `git clone https://github.com/sandboxnu/course-catalog-api`
- Change into the repo directory: `cd ./course-catalog-api`
- Switch Node versions: `fnm use`
  - There is a file called `.nvmrc` in the repository, which tells `fnm` which version to use

### Yarn

- `yarn` is our package manager of choice - we use it to manage all of the dependencies we are using for this project.
- Run `npm i -g yarn`
  - If you ever switch Node versions, you'll have to reinstall this (see this [issue](https://github.com/Schniz/fnm/issues/109))

### Github notifications

To make sure that our code gets reviewed promptly, we\'ll enable **Scheduled Reminders** for Github.

You can follow the instructions [here on Github\'s documentation site.](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-your-membership-in-organizations/managing-your-scheduled-reminders)

Whenever you get assigned as a reviewer for a teammate\'s code, you\'ll be notified on Slack. Don\'t worry if these terms aren\'t familiar yet!

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

### Node Version Manager (nvm)

- Install [NVM](https://github.com/nvm-sh/nvm) - this helps manage Node versions
  - Run `nvm install node`
    - This will install the latest version by default. That's fine for now, although we will be using a specific version in later steps. More on that in a bit.

### Yarn

- `yarn` is our package manager of choice - we use it to manage all of the dependencies we are using for this project.
- Run `npm i -g yarn`

### Source code

- Clone the repo: `git clone https://github.com/sandboxnu/course-catalog-api`
- Change into the repo directory: `cd ./course-catalog-api`
- Switch Node versions: `nvm use`
  - There is a file called `.nvmrc` in the repository, which tells `nvm` which version to use

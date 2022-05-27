### Not for local testing

Don't run these locally. All of the setup work is done via Github workflows (see the `.github` folder).

These tests are all based on an environment which has already undergone some _specific_ setup, and it assumes the tests are running on a disposable environment; data isn't preserved, existing setups aren't respected, etc.

At a bare minimum, the Docker containers are running, the schemas have been populated, and there's some data - check the workflows for more information.

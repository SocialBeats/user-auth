# Release v0.0.5

## Features
- feat: kafka events on actions
- feat: kafka producer
- feat: kafka init configuration
- feat: add profile verification using internal api key (Persona)
- feat: handle profile completion steps

## Tests
- test: tests for kafkaProducer
- test: updated tests

## Documentation
No documentation changes.
## Fixes
- fix: linter fix

## Continuous integration (CI)
No CI changes.
## Other changes
- Merge pull request #41 from SocialBeats/develop
- Merge pull request #40 from SocialBeats/feat/kafka
- Merge branch 'feat/kafka' of https://github.com/SocialBeats/user-auth into feat/kafka
- Update src/services/kafkaProducer.js
- Update main.js
- Update main.js
- Update spec/oas.yaml
- Update src/routes/healthRoutes.js
- Update src/services/adminService.js
- Update src/services/kafkaProducer.js
- Merge pull request #39 from SocialBeats/feat/persona-integration
- Merge pull request #38 from SocialBeats/feat/ramon-features
- Merge pull request #37 from SocialBeats/main

## Full commit history

For full commit history, see [here](https://github.com/SocialBeats/user-auth/compare/v0.0.3...v0.0.5).

# Release v0.0.3

## Features

- feat: basic repository for other microservice
- feat: update .env.examples
- feat: upload pdfs for certifications
- feat: add S3 upload functionality with presigned URLs

## Tests

- test: integration
- test: controllers
- test: middlewares
- test: services
- test: setup

## Documentation

No documentation changes.

## Fixes

- fix: update API version in OAS

## Continuous integration (CI)

No CI changes.

## Other changes

- chore: update oas version
- Merge branch 'main' of https://github.com/SocialBeats/user-auth
- chore: add oas yaml
- Merge pull request #36 from SocialBeats/develop
- Merge branch 'develop' of https://github.com/SocialBeats/user-auth into develop
- chore: oas yml
- Merge pull request #35 from SocialBeats/release-fix
- Merge pull request #33 from SocialBeats/test/coverage
- Merge pull request #32 from SocialBeats/feat/s3-integration
- Merge branch 'feat/s3-integration' of https://github.com/SocialBeats/user-auth into feat/s3-integration
- Update src/controllers/uploadController.js
- Update src/controllers/uploadController.js
- Update src/routes/uploadRoutes.js

## Full commit history

For full commit history, see [here](https://github.com/SocialBeats/user-auth/compare/v0.0.2...v0.0.3).

# Release v0.0.2

## Features

- feat: add cascade deletion for Profile when User is deleted
- feat: preliminary profile model

## Tests

No test changes.

## Documentation

No documentation changes.

## Fixes

No fixes added.

## Continuous integration (CI)

No CI changes.

## Other changes

- Merge pull request #24 from SocialBeats/develop
- chore: prepare .env for infrastructure
- refactor: handle access token if it expired when logging out
- Merge pull request #22 from SocialBeats/feat/profile-model
- Merge branch 'feat/profile-model' of https://github.com/SocialBeats/user-auth into feat/profile-model
- refactor: rollback to public logout route
- Merge pull request #23 from SocialBeats/copilot/sub-pr-22
- refactor: check profile existence before deletion
- Initial plan
- Update src/routes/profileRoutes.js
- refactor: linting warnings

## Full commit history

For full commit history, see [here](https://github.com/SocialBeats/user-auth/compare/v0.0.1...v0.0.2).

# Release v0.0.1

## Features

- feat: added admin management
- feat: typos and enhance errors for login workflow in frontend
- feat: refactor authentication flow and enhance error handling
- feat: implement refresh token rotation
- feat: set network as external, everything seems to connect.
- feat: update docker-compose files for auth service and redis configuration
- feat: minor changes in docker-network for communication with api-gateway
- feat: add auth routes and update middleware
- feat: implement authentication services
- feat: add User model and role-based middleware
- feat: configure Redis client

## Tests

No test changes.

## Documentation

- docs: update Swagger documentation for /refresh endpoint response schema
- docs: swagger documentation

## Fixes

- fix: mongodb container name changed
- fix: main js updated with redis
- fix: main js updated with routes

## Continuous integration (CI)

No CI changes.

## Other changes

- Merge pull request #21 from SocialBeats/develop
- Merge pull request #18 from SocialBeats/feat/admin-routes
- Update src/services/adminService.js
- Update src/services/adminService.js
- Update src/utils/initAdmin.js
- Update src/services/adminService.js
- Merge pull request #16 from SocialBeats/feat/refactor-1
- Merge pull request #13 from SocialBeats/feat/refresh-token-rotation
- Merge pull request #14 from SocialBeats/copilot/sub-pr-13
- Initial plan
- Merge pull request #5 from SocialBeats/feat/api-integration
- Merge pull request #4 from SocialBeats/feat/JWT-setup
- chore: configure Docker with Redis
- build: add bcrypt and ioredis dependencies
- Initial commit

## Full commit history

For full commit history, see [here](https://github.com/SocialBeats/user-auth/compare/...v0.0.1).

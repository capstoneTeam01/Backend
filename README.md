this is a test for checking the branch setup

## Environment Variables for Databases

The backend uses environment variables to securely manage MongoDB and Redis database connections. Database credentials and connection strings are not hardcoded in the source code.

## Redis Connection and Security

The backend uses Redis for session/token management and caching. Redis client libraries are installed using:

npm install redis
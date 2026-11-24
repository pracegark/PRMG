# AWS application setup

The website remains on Amplify app `app6678` and keeps `primermg.com` as its custom domain. The API is a separate AWS service in `us-east-2`; it uses its AWS-provided `execute-api` address, so the domain and DNS records do not need to change.

## Prepared in this repository

- `database/schema.postgres.sql` creates the jobs, general jobs, users, contacts, and candidate trades tables.
- `database/general-jobs.json` contains the searchable job-title list.
- `aws-api/handler.mjs` serves the website API routes.
- `aws-api/migrate.mjs` applies the schema, seeds job titles, creates the restricted application database user, and adds the first admin account.
- `infrastructure/rds-postgres.yaml` creates the private PostgreSQL database, API and migration Lambdas, API Gateway endpoint, secrets, and private network access.
- `npm run package:aws-api` creates the Lambda ZIP at `dist/prmg-api.zip`.

## AWS deployment sequence

1. Upload `dist/prmg-api.zip` to `s3://prmg-resumes-605134439001/deployment/prmg-api.zip` in `us-east-2`.
2. Create a CloudFormation stack from `infrastructure/rds-postgres.yaml` in `us-east-2`, using VPC `vpc-09961d7faad367d8c`, two subnets in different Availability Zones, route table `rtb-0f2882290703c8124`, the resume bucket above, and the ZIP key `deployment/prmg-api.zip`.
3. Once the stack finishes, run the `prmg-db-migrate` Lambda once. It creates the tables and initial administrator.
4. Retrieve the generated first-admin password from the secret ARN shown by the stack output `InitialAdminSecretArn`. The username is `admin`.
5. Use the stack output `ApiBaseUrl` as `PRMG_API_BASE_URL` for Amplify app `app6678`'s site branch. This does not require changing the custom domain.

The database is encrypted, has no public network address, allows database access only from the API Lambdas, and has deletion protection plus automated backups. The stack also creates a Secrets Manager interface endpoint and an S3 gateway endpoint so VPC-attached Lambdas can reach the services they need without a NAT gateway.

The RDS instance and interface endpoint incur ongoing AWS charges. Check the current estimate in the CloudFormation review before creating the stack; the exact total depends on the selected database class, storage, region, and AWS account pricing eligibility.

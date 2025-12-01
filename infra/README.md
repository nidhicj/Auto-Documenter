# Infrastructure

This directory contains infrastructure-as-code configurations for deploying AutoDoc AI to production.

## Terraform

Terraform modules for AWS infrastructure:

- VPC with public/private subnets
- RDS PostgreSQL database
- ElastiCache Redis
- S3 bucket for media storage
- Security groups

### Usage

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

## Helm Charts

Helm charts for Kubernetes deployment:

- `backend/` - NestJS backend service
- `frontend/` - Next.js frontend service
- `ai-service/` - FastAPI AI service

### Usage

```bash
helm install backend ./helm/backend
helm install frontend ./helm/frontend
helm install ai-service ./helm/ai-service
```

## Environment Variables

Set these in your Kubernetes secrets or CI/CD pipeline:

- `DATABASE_URL`
- `REDIS_URL`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `JWT_SECRET`
- `GOOGLE_GEMINI_API_KEY`



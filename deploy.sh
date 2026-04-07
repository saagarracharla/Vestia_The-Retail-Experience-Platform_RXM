#!/bin/bash
set -e

ACCOUNT_ID="125667709386"
REGION="ca-central-1"
REPO_NAME="vestia-frontend"
CLUSTER_NAME="vestia-cluster"
SERVICE_NAME="vestia-frontend-service"
TASK_FAMILY="vestia-frontend"
IMAGE_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest"

# ── 1. ECR ──────────────────────────────────────────────────────────────────

echo "==> Creating ECR repository (if needed)..."
aws ecr create-repository \
  --repository-name $REPO_NAME \
  --region $REGION 2>/dev/null || echo "    (already exists)"

echo "==> Logging in to ECR..."
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin \
  "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

echo "==> Building Docker image (linux/amd64 for ECS)..."
docker build --platform linux/amd64 -t $REPO_NAME frontend/

echo "==> Pushing to ECR..."
docker tag $REPO_NAME:latest $IMAGE_URI
docker push $IMAGE_URI

# ── 2. ECS Cluster ──────────────────────────────────────────────────────────

echo "==> Creating ECS cluster (if needed)..."
aws ecs create-cluster \
  --cluster-name $CLUSTER_NAME \
  --capacity-providers FARGATE \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
  --region $REGION 2>/dev/null || echo "    (already exists)"

# ── 3. Networking ────────────────────────────────────────────────────────────

echo "==> Getting default VPC..."
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=isDefault,Values=true" \
  --query "Vpcs[0].VpcId" \
  --output text --region $REGION)
echo "    VPC: $VPC_ID"

echo "==> Getting subnets..."
read -ra SUBNET_ARRAY <<< "$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=defaultForAz,Values=true" \
  --query "Subnets[*].SubnetId" \
  --output text --region $REGION)"
SUBNET_SPACE="${SUBNET_ARRAY[*]}"
SUBNET_CSV=$(IFS=','; echo "${SUBNET_ARRAY[*]}")
echo "    Subnets: $SUBNET_SPACE"

echo "==> Creating ALB security group (if needed)..."
ALB_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=vestia-alb-sg" "Name=vpc-id,Values=$VPC_ID" \
  --query "SecurityGroups[0].GroupId" --output text --region $REGION 2>/dev/null)
if [ -z "$ALB_SG_ID" ] || [ "$ALB_SG_ID" = "None" ]; then
  ALB_SG_ID=$(aws ec2 create-security-group \
    --group-name vestia-alb-sg \
    --description "Vestia ALB" \
    --vpc-id "$VPC_ID" \
    --region $REGION \
    --query "GroupId" --output text)
  aws ec2 authorize-security-group-ingress \
    --group-id "$ALB_SG_ID" \
    --protocol tcp --port 80 --cidr 0.0.0.0/0 \
    --region $REGION
fi
echo "    ALB SG: $ALB_SG_ID"

echo "==> Creating task security group (if needed)..."
TASK_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=vestia-task-sg" "Name=vpc-id,Values=$VPC_ID" \
  --query "SecurityGroups[0].GroupId" --output text --region $REGION 2>/dev/null)
if [ -z "$TASK_SG_ID" ] || [ "$TASK_SG_ID" = "None" ]; then
  TASK_SG_ID=$(aws ec2 create-security-group \
    --group-name vestia-task-sg \
    --description "Vestia ECS Tasks" \
    --vpc-id "$VPC_ID" \
    --region $REGION \
    --query "GroupId" --output text)
  aws ec2 authorize-security-group-ingress \
    --group-id "$TASK_SG_ID" \
    --protocol tcp --port 3000 \
    --source-group "$ALB_SG_ID" \
    --region $REGION
fi
echo "    Task SG: $TASK_SG_ID"

# ── 4. IAM Role ──────────────────────────────────────────────────────────────

echo "==> Creating ECS task execution role (if needed)..."
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  2>/dev/null || echo "    (already exists)"
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy \
  2>/dev/null || true

# ── 5. CloudWatch Logs ───────────────────────────────────────────────────────

echo "==> Creating CloudWatch log group..."
aws logs create-log-group \
  --log-group-name /ecs/vestia-frontend \
  --region $REGION 2>/dev/null || echo "    (already exists)"

# ── 6. Task Definition ───────────────────────────────────────────────────────

echo "==> Registering ECS task definition..."
cat > /tmp/vestia-container-def.json << EOF
[
  {
    "name": "vestia-frontend",
    "image": "$IMAGE_URI",
    "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
    "essential": true,
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/vestia-frontend",
        "awslogs-region": "$REGION",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }
]
EOF

aws ecs register-task-definition \
  --region $REGION \
  --family $TASK_FAMILY \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 256 \
  --memory 512 \
  --execution-role-arn "arn:aws:iam::$ACCOUNT_ID:role/ecsTaskExecutionRole" \
  --container-definitions file:///tmp/vestia-container-def.json \
  --query "taskDefinition.taskDefinitionArn" --output text

# ── 7. Application Load Balancer ─────────────────────────────────────────────

echo "==> Creating Application Load Balancer (if needed)..."
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names vestia-alb \
  --region $REGION \
  --query "LoadBalancers[0].LoadBalancerArn" \
  --output text 2>/dev/null)
if [ -z "$ALB_ARN" ] || [ "$ALB_ARN" = "None" ]; then
  ALB_ARN=$(aws elbv2 create-load-balancer \
    --name vestia-alb \
    --subnets $SUBNET_SPACE \
    --security-groups "$ALB_SG_ID" \
    --region $REGION \
    --query "LoadBalancers[0].LoadBalancerArn" \
    --output text)
fi
echo "    ALB ARN: $ALB_ARN"

echo "==> Creating target group (if needed)..."
TG_ARN=$(aws elbv2 describe-target-groups \
  --names vestia-tg \
  --region $REGION \
  --query "TargetGroups[0].TargetGroupArn" \
  --output text 2>/dev/null)
if [ -z "$TG_ARN" ] || [ "$TG_ARN" = "None" ]; then
  TG_ARN=$(aws elbv2 create-target-group \
    --name vestia-tg \
    --protocol HTTP \
    --port 3000 \
    --vpc-id "$VPC_ID" \
    --target-type ip \
    --health-check-path "/" \
    --healthy-threshold-count 2 \
    --region $REGION \
    --query "TargetGroups[0].TargetGroupArn" \
    --output text)
fi
echo "    Target Group ARN: $TG_ARN"

echo "==> Creating ALB listener (if needed)..."
aws elbv2 create-listener \
  --load-balancer-arn "$ALB_ARN" \
  --protocol HTTP --port 80 \
  --default-actions Type=forward,TargetGroupArn="$TG_ARN" \
  --region $REGION 2>/dev/null || echo "    (already exists)"

# ── 8. ECS Service ───────────────────────────────────────────────────────────

echo "==> Creating ECS service..."
EXISTING_SERVICE=$(aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --region $REGION \
  --query "services[?status=='ACTIVE'].serviceArn" \
  --output text 2>/dev/null)

if [ -z "$EXISTING_SERVICE" ] || [ "$EXISTING_SERVICE" = "None" ]; then
  aws ecs create-service \
    --cluster $CLUSTER_NAME \
    --service-name $SERVICE_NAME \
    --task-definition $TASK_FAMILY \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_CSV],securityGroups=[$TASK_SG_ID],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=$TG_ARN,containerName=vestia-frontend,containerPort=3000" \
    --region $REGION \
    --query "service.serviceArn" --output text
else
  echo "    (service already exists — updating task definition only)"
  aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --task-definition $TASK_FAMILY \
    --region $REGION \
    --query "service.serviceArn" --output text
fi

# ── 9. Wait and print URL ─────────────────────────────────────────────────────

ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns "$ALB_ARN" \
  --region $REGION \
  --query "LoadBalancers[0].DNSName" \
  --output text)

echo ""
echo "Waiting for service to stabilise (this takes ~2-3 minutes)..."
aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --region $REGION

echo ""
echo "==========================================="
echo "  Vestia is live at:"
echo "  http://$ALB_DNS"
echo "==========================================="

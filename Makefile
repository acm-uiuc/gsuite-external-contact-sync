current_aws_account := $(shell aws sts get-caller-identity --query Account --output text)
npm_install_params = --omit=dev --target_arch=arm64 --target_platform=linux --target_libc=glibc --cpu arm64 --os linux --arch=arm64

.PHONY: clean


clean:
	rm -rf node_modules/
	rm -rf dist/


build: src/
	mkdir -p dist/
	mkdir -p .keep/
	touch .keep/keep
	yarn -D
	yarn build

local:
	npx tsx src/local.ts

deploy:
	@echo "Deploying Terraform..."
	terraform -chdir=terraform/envs/general init -lockfile=readonly
	terraform -chdir=terraform/envs/general plan -out=tfplan
	terraform -chdir=terraform/envs/general apply -auto-approve tfplan
	rm terraform/envs/general/tfplan

init_terraform:
	terraform -chdir=terraform/envs/general init

install:
	yarn -D

test_unit: install
	yarn lint
	terraform -chdir=terraform/envs/general init -reconfigure -backend=false -upgrade
	terraform -chdir=terraform/envs/general fmt -check
	terraform -chdir=terraform/envs/general validate

lock_terraform:
	terraform -chdir=terraform/envs/general providers lock -platform=windows_amd64 -platform=darwin_amd64 -platform=darwin_arm64 -platform=linux_amd64 -platform=linux_arm64

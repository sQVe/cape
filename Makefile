.PHONY: check format lint validate

check: lint validate
	bunx prettier --check .

format:
	bunx prettier --write .

lint:
	bunx tsc

validate:
	bun scripts/validate.ts

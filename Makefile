.PHONY: run-api

run-api:
	uvicorn backend_api.main:app --reload

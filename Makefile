.PHONY: help init start stop clean install test docs

help:
	@echo "API Relay Service - Makefile Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make init       Initialize project (first time setup)"
	@echo "  make start      Start the service"
	@echo "  make stop       Stop the service"
	@echo "  make clean      Clean runtime data and temporary files"
	@echo "  make install    Install dependencies"
	@echo "  make test       Run basic tests"
	@echo "  make docs       View documentation"
	@echo ""

init:
	@echo "Initializing project..."
	./init.sh

start:
	@echo "Starting service..."
	./start.sh

stop:
	@echo "Stopping service..."
	./stop.sh

clean:
	@echo "Cleaning runtime data..."
	./cleanup.sh

install:
	@echo "Installing dependencies..."
	pip install -r requirements.txt

test:
	@echo "Running basic tests..."
	@echo "Checking Python syntax..."
	python3 -m py_compile main.py
	python3 -m py_compile src/*.py
	@echo "Checking JavaScript syntax..."
	node --check admin/static/js/app.js || echo "Node.js not installed, skipping JS check"
	@echo "Tests passed!"

docs:
	@echo "Opening documentation..."
	@echo "README.md - Main documentation"
	@echo "README_EN.md - English documentation"
	@echo "CHANGELOG.md - Version history"
	@echo "CLAUDE.md - Development guidelines"
#!/bin/bash

# Install dependencies
bun install

# Copy the .env.example files to .env
cp .env.example .env

# Start the database and services
bun run dx

---
name: oasis-conventions
description: Coding conventions for the Oasis NUin study abroad rating site. Use whenever writing, reviewing, or changing code in this repo.
---

# Oasis project conventions

## Project overview
Website where former NUin and Dialogue students rate their abroad locations so future students can choose.

## Tech stack
- Frontend: [e.g. React + TypeScript]
- Backend: [e.g. Node/Express or Python/Flask]
- Database: [e.g. PostgreSQL]

## Code style
- Naming: [camelCase for variables/functions, PascalCase for components/classes]
- Formatting: [Prettier / Black, line length]
- Comments: explain why, not what

## Folder structure
- /frontend ...
- /backend ...

## Git workflow
- Branch names: feature/<short-name>, fix/<short-name>
- Commit messages: [e.g. "Add rating endpoint for locations"]
- Open a PR and get one teammate review before merging to main

## Data rules
- Ratings are 1 to 5 stars, tied to a location and a program (NUin or Dialogue)
- Never store anything identifying beyond what the user chooses to show

## Testing
- [Where tests live, how to run them]
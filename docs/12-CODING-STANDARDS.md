# LeadPages Coding Standards

## General Standards

- Prefer simple, readable code.
- Avoid unnecessary dependencies.
- Keep serverless constraints in mind.
- Preserve existing behaviour.
- Keep functions focused.
- Document complex business logic.

## JavaScript

- Use clear names.
- Avoid hidden global side effects where possible.
- When editing large HTML files, minimise unrelated changes.
- Extract shared helpers only when the behaviour is well understood.

## API Functions

- Validate inputs.
- Protect privileged endpoints.
- Return useful errors without leaking secrets.
- Keep tenant isolation strict.
- Prefer shared auth helpers where possible.

## Config Changes

- Add defaults.
- Preserve unknown fields.
- Avoid destructive overwrites.
- Document new config shape.

## Git Workflow

- Small changes.
- Clear commit messages.
- One feature/fix per commit where practical.
- Do not mix refactoring with product changes unless approved.

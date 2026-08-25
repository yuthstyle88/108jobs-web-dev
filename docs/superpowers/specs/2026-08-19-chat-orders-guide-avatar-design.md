# Chat Orders Guide and Avatar Design

## Scope

- Keep the top-level `/[lang]/chat` route as a neutral “select a conversation” state.
- Put the hiring guide inside the active room’s Orders tab.
- When a room has an associated job, keep the existing job workflow and add a locale-aware button to that job’s detail page.
- When a room has no associated job, replace the meaningless workflow shell with the centered hiring-guide prompt.
- Keep incoming message avatars square and circular beside messages of every height.

## Approved behavior

`JobFlowContent` is the decision boundary for the Orders tab. A valid job ID, derived from the hydrated post first and the room's `postId` association as a fallback, renders a Job Details link followed by the existing workflow node. An absent job ID renders `HowToHireGuide`, which owns the prompt and the existing 108heros-specific modal. `ChatSidebarTabs` remains responsible only for switching between Orders and Media.

The avatar fix has two layers: Tailwind must scan `src/modules`, and the incoming message avatar is rendered inside a fixed, non-shrinking wrapper with a cover-fitted image. This fixes the root configuration error and prevents future message-card layout changes from stretching the image.

## Verification

- Unit tests cover the Orders job/no-job branches, the job-details URL, the avatar wrapper, and the Tailwind module scan path.
- Existing unit tests, lint, type/build checks, and whitespace checks remain clean.
- The supplied authenticated room is checked in a real browser at desktop and narrow viewport sizes, including modal interaction, avatar dimensions, and history scrolling.

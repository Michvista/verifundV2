# VeriFund Design System

This system is based on the production UI direction shown in the design reference: dark dotted workspace, cool blue panels, deep navy primary surfaces, electric blue secondary actions, mint success/accent states, and mono labels.

## Color Tokens

| Token | Value | Usage |
| --- | --- | --- |
| Primary | `#0A1628` | Sidebar, dark panels, product preview surfaces |
| Secondary | `#1B6FEB` | Secondary action emphasis and data highlights |
| Tertiary | `#00D4AA` | Success, positive state, live connection, accent captions |
| Neutral | `#64748B` | Body metadata, muted labels, supporting text |
| App background | `#D9E6F9` | Auth screens and app workspace |
| Panel | `#DCE8F8` / `#E8F1FF` | Cards, search fields, controls |
| Danger | `#D92D20` | Destructive actions and error states |

## Typography

- Display: `Hanken Grotesk`
- Body: `Inter`
- Labels and technical metadata: `JetBrains Mono`

Use display type for page titles, balances, scores, and brand marks. Use mono type for short UI labels, pills, table headers, and environment/status metadata.

## Surfaces

- Public landing pages use the dark dotted background.
- Product workspace pages use pale blue panels over a pale blue app background.
- The sidebar uses the primary navy surface.
- Cards use `--radius-panel` and should feel like grouped operating surfaces, not floating marketing blocks.

## Controls

- Primary buttons are black with white text.
- Secondary and ghost buttons stay outlined unless a workflow needs stronger emphasis.
- Search and input fields use pale panel backgrounds with thin neutral borders.
- Status pills use mono uppercase text and semantic color fills.

## Implementation Notes

The canonical implementation is in `src/styles.css` under the root CSS variables. Prefer using existing variables before adding new colors. If a new state is needed, add a named token first instead of hard-coding a one-off color in a component.

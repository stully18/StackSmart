# Frontend interaction conventions

Keep StackSmart's navy surfaces, lime accents, typography, and page layouts. Motion should clarify a state change without delaying an action.

- Use short color, border, shadow, and opacity transitions for interactive controls. Keep movement small and avoid scaling whole forms or menu rows.
- Keep keyboard focus visible, including on links, selection cards, and range controls. Preserve native keyboard behavior for inputs and selects.
- Use `components/ui/NumberInput` for numeric text fields. Preserve the field's validation, minimum, maximum, and step; custom step buttons must not submit the surrounding form. Direct typing remains available.
- Use native select controls with themed surfaces rather than replacing their keyboard and assistive-technology behavior.
- Menus expose their expanded state and close on Escape. Confirmation dialogs contain focus and restore it to the opener when dismissed.
- Respect the operating system's reduced-motion preference in both CSS and Framer Motion. Loading and feedback must remain understandable without animation.
- Keep authentication, API requests, financial calculations, and persistence separate from presentation changes.

Before releasing interaction changes, check desktop and mobile layouts, keyboard access, numeric boundaries and decimals, loading and error states, and reduced motion. Inspect the actual rendered components with Playwright and run the relevant frontend checks.

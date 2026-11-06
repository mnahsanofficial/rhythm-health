# 15. Content-rich web, focused mobile

**Status:** Accepted for the approved parity scope. **Date:** 6 Nov 2026. **Source:** Nazmul’s request to bring web up to mobile quality while using desktop space for useful context.

## Context

Mobile deliberately presents one decision per screen. Repeating that exact layout on a wide browser leaves useful space empty; exposing the whole proposal or every daily question creates cognitive overload. Both clients already share API types, server day rules and brand tokens.

## Decision

Web keeps one heading and one primary next action, with short labels and full-contrast body text. At desktop widths, a second column holds context that helps the current decision: a named weekly ring, a reacting scene, a guess comparison or the proposed days. Phone web layouts stack this context and retain large native controls. Long instructions and reasoning belong in disclosures.

The frontend owns presentation and step navigation. The existing data layer owns requests, auth, error handling and write guards; the backend supplies experiment days, receipts, forecasts and observations. No client invents progress or derives a health conclusion from a decorative scene.

Motion answers selection, navigation or a real pending request. Only opacity and transform animate here; reduced motion shows the final state. Predictions and results never count through intermediate numbers. The web check-in celebration waits for explicit Continue, so people using a keyboard or screen reader have time to read and edit it.

## Consequences

Desktop and mobile can differ in composition while preserving the same product facts. Mobile source and word budgets remain unchanged and its tests still run with web checks. API and brand changes remain shared work rather than client-specific forks.

This ADR describes the direction, not a claim that every feature has shipped. Today and check-in are merged. Plan and question-choice changes are prepared for review; the remaining report, outcome, Progress and landing parity is after the demo. See [final status](../FINAL_STATUS.md#web-parity-handover--6-nov) and [evidence](../design/08-web-parity.md).

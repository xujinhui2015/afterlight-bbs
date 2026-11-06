# Devpost submission draft

This is draft material for further editing. It has **not** been submitted to Devpost. Update it against the actual application, deployment, verification results, and real Kiro development evidence before submission.

## Name, category, and links

**Afterlight BBS**

Intended category: **Resurrection**.

One sentence: Revive the dial-up community bulletin board as a local tool for organizing requests and resources in weak-connectivity settings.

- Repository: https://github.com/xujinhui2015/afterlight-bbs
- Working prototype: https://xujinhui2015.github.io/afterlight-bbs/
- English setup and testing instructions: [README.en.md](../README.en.md)

## Project description draft

Early bulletin board systems made it easy to leave a clear message and discover a community. Afterlight BBS revives that interaction pattern to help neighborhood volunteers organize requests and resource offers.

Users can publish posts, search by neighborhood or keyword, inspect explainable rule-based matches, mark requests as completed, and exchange posts through JSON files. A terminal-inspired visual identity preserves the BBS connection while a responsive layout supports phones and keyboard use.

The current prototype stores data in the browser. It does not provide real-time multiuser synchronization, online AI, verified information, or guaranteed human responses. It is an information-organizing prototype, not an operational emergency dispatch system.

Service Worker caching is implemented, but complete offline acceptance remains pending: after the local preview server was stopped, the in-app browser did not restore the full interface on refresh. Resolve and verify this limitation before demonstrating reliable offline reload.

## How it was built: complete before submission

Codex created the initial prototype on November 6, 2026. **Kiro has not yet been used for actual development.** Prepared `.kiro/` files are inputs for future work, not a claim of Kiro-generated results.

The planned Kiro task is JSON import conflict preview and explicit selection between local and imported versions. After performing it, rewrite this section using the actual inputs, changes, validation, and lessons recorded in [the Kiro work log](kiro-worklog.md). Do not fabricate hook runs, MCP use, conversations, or implementation evidence.

## Demonstration outline: under three minutes

| Time | Screen and explanation |
| --- | --- |
| 0:00–0:20 | Show the board and explain the reason for reviving BBS interaction for local mutual aid. |
| 0:20–0:55 | Search example posts, publish a request, and show category and neighborhood. |
| 0:55–1:25 | Open details and explain the suggested resource matches. |
| 1:25–1:45 | Complete and reopen a post; refresh to demonstrate persistence. |
| 1:45–2:10 | Export and import JSON; explain the merge policy. Demonstrate offline behavior only after it has been verified. |
| 2:10–2:40 | Show real Kiro development and its corresponding results. Record this segment after actual Kiro work. |
| 2:40–2:55 | Show the repository, setup instructions, and known limitations. |

The video should show the actual application running. Use English narration or an English translation, stay under three minutes, and avoid unlicensed music, assets, or third-party trademarks.

## Final submission checklist

- [ ] Confirm personal and team eligibility under the [official rules](https://kiroween.devpost.com/rules).
- [ ] Recheck the public GitHub repository, complete sources and assets, setup instructions, and detectable MIT License.
- [ ] Recheck that the root `.kiro/` directory is committed and not ignored.
- [ ] Use Kiro for real development and provide an accurate write-up with verifiable evidence.
- [ ] Recheck automated tests, production build, and browser interactions against the final revision.
- [ ] Resolve and verify offline refresh; record actual browser results.
- [ ] Recheck the working application link and English testing instructions.
- [ ] Record an actual demonstration under three minutes and publish it publicly on YouTube.
- [ ] Fill in the Devpost project description, category, repository, application, video, and Kiro write-up.
- [ ] Select bonus prizes only when their eligibility and extra requirements are satisfied.
- [ ] Submit by December 4, 2026, 2:00 PM PST / December 5, 2026, 06:00 Beijing time, and verify the Devpost submission state.

These final checks remain unchecked so they can be reviewed against the exact submission revision. They do not imply that a formal competition submission has been completed.
